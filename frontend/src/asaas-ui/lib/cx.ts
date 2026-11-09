/** Joins truthy class names. */
export const cx = (...names: Array<any>) => names.filter(Boolean).join(' ');
