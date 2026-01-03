/**
 * 计算由两个点确定的矩形（用于框选截图）
 * @param {{x:number,y:number}} start
 * @param {{x:number,y:number}} end
 * @returns {{x:number,y:number,width:number,height:number}}
 */
export function getRectFromPoints(start, end) {
  const x = Math.min(start.x, end.x);
  const y = Math.min(start.y, end.y);
  const width = Math.abs(end.x - start.x);
  const height = Math.abs(end.y - start.y);
  return { x, y, width, height };
}

