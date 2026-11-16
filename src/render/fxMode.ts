let lite = false;

export function isLiteFx(params: URLSearchParams): boolean {
  return params.get('debug') === '1' && params.get('fx') === 'lite';
}

export function configureFx(params: URLSearchParams): void {
  lite = isLiteFx(params);
}

export function getLiteFx(): boolean {
  return lite;
}

export function preserveLiteFx(
  from: URLSearchParams,
  to: URLSearchParams,
): void {
  if (isLiteFx(from)) to.set('fx', 'lite');
}
