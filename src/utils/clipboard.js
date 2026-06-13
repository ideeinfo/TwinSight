export async function copyTextToClipboard(text) {
  const value = String(text || '');
  if (!value) {
    throw new Error('复制内容为空');
  }

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  textarea.style.top = '0';
  document.body.appendChild(textarea);
  textarea.select();

  try {
    const copied = document.execCommand('copy');
    if (!copied) {
      throw new Error('当前浏览器不支持自动复制');
    }
  } finally {
    document.body.removeChild(textarea);
  }
}
