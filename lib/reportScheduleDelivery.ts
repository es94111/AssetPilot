type DeliveryInput = {
  notifyLine?: unknown;
  notifyEmail?: unknown;
  enabled?: unknown;
};

export function reportDeliveryInputError(body: DeliveryInput | null): string | null {
  if (body?.notifyLine !== undefined && body.notifyLine !== false) {
    return "LINE 報表已停止提供";
  }
  if (body?.notifyEmail !== undefined && typeof body.notifyEmail !== "boolean") {
    return "notifyEmail 必須為布林值";
  }
  if (body?.enabled !== undefined && typeof body.enabled !== "boolean") {
    return "enabled 必須為布林值";
  }
  return null;
}
