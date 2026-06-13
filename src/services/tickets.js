import { useAuthStore } from '../stores/auth';
import { API_BASE_URL } from '../utils/apiBase';

const API_V1 = `${API_BASE_URL}/api/v1`;

const getHeaders = () => {
    const authStore = useAuthStore();
    const headers = {};
    if (authStore.token) {
        headers.Authorization = `Bearer ${authStore.token}`;
    }
    return headers;
};

const buildUrl = (path, params = {}) => {
    const url = new URL(`${API_V1}${path}`, window.location.origin);
    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
            url.searchParams.set(key, String(value));
        }
    });
    return url.toString().replace(window.location.origin, API_BASE_URL);
};

const parseResponse = async (response, fallbackMessage) => {
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.success) {
        throw new Error(data.error || data.message || fallbackMessage);
    }
    return data.data;
};

export async function listTickets(params = {}) {
    const response = await fetch(buildUrl('/tickets', params), {
        headers: getHeaders(),
    });
    return parseResponse(response, '获取工单列表失败');
}

export async function getTicketById(id) {
    const response = await fetch(buildUrl(`/tickets/${id}`), {
        headers: getHeaders(),
    });
    return parseResponse(response, '获取工单失败');
}

export async function listTicketAssignees() {
    const response = await fetch(buildUrl('/tickets/assignees'), {
        headers: getHeaders(),
    });
    return parseResponse(response, '获取工单处理人失败');
}

export async function listTicketMarkers(params = {}) {
    const response = await fetch(buildUrl('/tickets/markers', params), {
        headers: getHeaders(),
    });
    return parseResponse(response, '获取工单模型气泡失败');
}

const submitTicketForm = async (path, payload, files = [], method = 'POST') => {
    const formData = new FormData();
    formData.append('payload', JSON.stringify(payload));
    files.forEach((file) => {
        formData.append('attachments', file);
    });

    const response = await fetch(buildUrl(path), {
        method,
        headers: getHeaders(),
        body: formData,
    });

    return parseResponse(response, '提交工单失败');
};

export async function createTicket(payload, files = []) {
    return submitTicketForm('/tickets', payload, files, 'POST');
}

export async function updateTicket(id, payload, files = []) {
    return submitTicketForm(`/tickets/${id}`, payload, files, 'PUT');
}

export async function deleteTicket(id) {
    const response = await fetch(buildUrl(`/tickets/${id}`), {
        method: 'DELETE',
        headers: getHeaders(),
    });
    return parseResponse(response, '删除工单失败');
}

export default {
    createTicket,
    deleteTicket,
    getTicketById,
    listTicketAssignees,
    listTicketMarkers,
    listTickets,
    updateTicket,
};
