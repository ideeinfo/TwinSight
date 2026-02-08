/**
 * AI 技能注册表
 * 动态加载技能定义并生成 System Prompt 片段
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 缓存已加载的技能
let skillsCache = null;

/**
 * 加载所有技能定义
 */
export async function loadSkills() {
    if (skillsCache) return skillsCache;

    const skills = [];
    try {
        const skillFiles = fs.readdirSync(__dirname)
            .filter(f => f.endsWith('.skill.json'));

        for (const file of skillFiles) {
            try {
                const content = fs.readFileSync(path.join(__dirname, file), 'utf-8');
                const skill = JSON.parse(content);
                skills.push(skill);
                console.log(`✅ 加载技能: ${skill.name} (${skill.id})`);
            } catch (err) {
                console.error(`❌ 加载技能失败: ${file}`, err);
            }
        }
    } catch (e) {
        console.warn('⚠️ No skills directory or failed to read:', e);
    }

    skillsCache = skills;
    return skills;
}

/**
 * 生成技能相关的 System Prompt 片段
 */
export function generateSkillPrompt(skills) {
    if (!skills || skills.length === 0) return '';

    let prompt = `\n## 可用系统操作\n`;
    prompt += `您可以控制TwinSight系统执行操作。当用户明确请求执行以下操作时，请务必在回复末尾附上一个特殊的 JSON 指令块。\n\n`;

    for (const skill of skills) {
        prompt += `### ${skill.name}\n`;
        prompt += `- **说明**: ${skill.description}\n`;
        prompt += `- **触发词**: ${skill.triggers.join('、')}\n`;
        prompt += `- **参数**:\n`;

        // Create example params object
        const exampleParams = {};

        for (const param of skill.parameters) {
            prompt += `  - \`${param.name}\`: ${param.description}`;
            if (param.enum) {
                prompt += ` (可选值: ${param.enum.join(', ')})`;
            }
            prompt += '\n';

            // Build example
            if (param.enum) exampleParams[param.name] = param.enum[0];
            else if (param.examples) exampleParams[param.name] = param.examples[0];
            else exampleParams[param.name] = "<value>";
        }

        prompt += `- **返回格式** (请严格遵守 JSON 格式, 不要包含注释):\n`;
        prompt += '```action\n';
        prompt += JSON.stringify({
            action: skill.id,
            params: exampleParams
        }, null, 2);
        prompt += '\n```\n\n';
    }

    prompt += `**重要执行规则**:\n`;
    prompt += `1. **仅在**用户意图清晰且明确需要操作时生成 action 块。\n`;
    prompt += `2. action 块必须放在回复的**最末尾**。\n`;
    prompt += `3. 使用 \`\`\`action ... \`\`\` 包裹 JSON。\n`;
    prompt += `4. 在回复的正文中，用自然语言告知用户正在执行该操作（例如：“好的，我正在为您切换到资产模块...”）。\n`;

    return prompt;
}

export default {
    loadSkills,
    generateSkillPrompt
};
