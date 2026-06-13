import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { Router } from 'express';
import { param, query } from 'express-validator';
import config from '../../config/index.js';
import { PERMISSIONS } from '../../config/auth.js';
import ticketModel from '../../models/ticket.js';
import { authenticate, authorize } from '../../middleware/auth.js';
import { ApiError } from '../../middleware/error-handler.js';
import { validateRequest } from '../../middleware/validate.js';

const router = Router();

const ticketUploadDir = path.join(config.upload.uploadDir, 'tickets');
if (!fs.existsSync(ticketUploadDir)) {
    fs.mkdirSync(ticketUploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, ticketUploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        cb(null, `${uniqueSuffix}${path.extname(file.originalname)}`);
    },
});

const upload = multer({
    storage,
    limits: {
        fileSize: 50 * 1024 * 1024,
        files: 10,
    },
});

const cleanupUploadedFiles = async (files = []) => {
    await Promise.all(
        files.map((file) => fs.promises.unlink(file.path).catch(() => {}))
    );
};

const parsePayload = (req) => {
    const rawPayload = req.body?.payload;
    if (!rawPayload) {
        throw ApiError.badRequest('缺少 payload');
    }

    try {
        return JSON.parse(rawPayload);
    } catch (error) {
        throw ApiError.badRequest('payload 不是合法 JSON');
    }
};

router.use(authenticate);

router.get('/assignees',
    authorize(PERMISSIONS.TICKET_READ),
    async (req, res, next) => {
        try {
            const assignees = await ticketModel.listAssignees();
            res.json({ success: true, data: assignees });
        } catch (error) {
            next(error);
        }
    }
);

router.get('/markers',
    authorize(PERMISSIONS.TICKET_READ),
    query('fileId').isInt().toInt(),
    query('facilityId').optional().isInt().toInt(),
    validateRequest,
    async (req, res, next) => {
        try {
            const markers = await ticketModel.listMarkers({
                facilityId: req.query.facilityId,
                fileId: req.query.fileId,
            });
            res.json({ success: true, data: markers });
        } catch (error) {
            next(error);
        }
    }
);

router.get('/',
    authorize(PERMISSIONS.TICKET_READ),
    query('facilityId').optional().isInt().toInt(),
    query('fileId').optional().isInt().toInt(),
    query('status').optional().isIn(['new', 'completed', 'closed']),
    query('spaceCode').optional().trim(),
    query('assetCode').optional().trim(),
    query('assigneeUserId').optional().isInt().toInt(),
    query('markerDbId').optional().isInt().toInt(),
    query('keyword').optional().trim(),
    validateRequest,
    async (req, res, next) => {
        try {
            const tickets = await ticketModel.listTickets(req.query);
            res.json({ success: true, data: tickets });
        } catch (error) {
            next(error);
        }
    }
);

router.get('/:id',
    authorize(PERMISSIONS.TICKET_READ),
    param('id').isInt().toInt(),
    validateRequest,
    async (req, res, next) => {
        try {
            const ticket = await ticketModel.getTicketById(req.params.id);
            if (!ticket) {
                throw ApiError.notFound('工单不存在');
            }
            res.json({ success: true, data: ticket });
        } catch (error) {
            next(error);
        }
    }
);

router.post('/',
    authorize(PERMISSIONS.TICKET_CREATE),
    upload.array('attachments', 10),
    async (req, res, next) => {
        const files = req.files || [];

        try {
            const payload = parsePayload(req);
            const ticket = await ticketModel.createTicket(payload, files, req.user?.sub ?? req.user?.id ?? null);
            res.status(201).json({ success: true, data: ticket });
        } catch (error) {
            await cleanupUploadedFiles(files);
            next(error);
        }
    }
);

router.put('/:id',
    authorize(PERMISSIONS.TICKET_UPDATE),
    param('id').isInt().toInt(),
    upload.array('attachments', 10),
    validateRequest,
    async (req, res, next) => {
        const files = req.files || [];

        try {
            const payload = parsePayload(req);
            const ticket = await ticketModel.updateTicket(req.params.id, payload, files);
            res.json({ success: true, data: ticket });
        } catch (error) {
            await cleanupUploadedFiles(files);
            next(error);
        }
    }
);

router.delete('/:id',
    authorize(PERMISSIONS.TICKET_DELETE),
    param('id').isInt().toInt(),
    validateRequest,
    async (req, res, next) => {
        try {
            await ticketModel.deleteTicket(req.params.id);
            res.json({ success: true, message: '工单已删除' });
        } catch (error) {
            next(error);
        }
    }
);

export default router;
