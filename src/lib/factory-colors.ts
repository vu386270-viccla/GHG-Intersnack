// ── Factory color palette — dùng chung cho mọi Scope tab ──
// 4 màu cực khác nhau để phân biệt nhà máy dễ dàng

export const FACTORY_COLOR_MAP: Record<string, string> = {
  // by factory code
  NM: '#3B82F6',  // xanh dương    — Nam Mỹ
  DC: '#F97316',  // cam           — Dĩ An Củ
  DA: '#8B5CF6',  // tím           — Dĩ An A
  TN: '#10B981',  // xanh lá       — Tân Thành
};

// Fallback palette khi có nhiều hơn 4 factory
export const FACTORY_PALETTE = [
  '#3B82F6', // xanh dương
  '#F97316', // cam
  '#8B5CF6', // tím
  '#10B981', // xanh lá
  '#EC4899', // hồng
  '#F59E0B', // vàng amber
  '#06B6D4', // cyan
  '#EF4444', // đỏ
];

export function getFactoryColor(code: string, index: number): string {
  return FACTORY_COLOR_MAP[code] ?? FACTORY_PALETTE[index % FACTORY_PALETTE.length];
}

export function getFactoryBg(code: string, index: number, alpha = '18'): string {
  return getFactoryColor(code, index) + alpha;
}
