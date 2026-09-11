export type DiffLine = {
  type: "equal" | "add" | "remove";
  text: string;
};

function lcsMatrix(a: string[], b: string[]): number[][] {
  const rows = a.length;
  const cols = b.length;
  const matrix = Array.from({ length: rows + 1 }, () => Array.from({ length: cols + 1 }, () => 0));
  for (let i = 1; i <= rows; i += 1) {
    for (let j = 1; j <= cols; j += 1) {
      matrix[i]![j] = a[i - 1] === b[j - 1] ? matrix[i - 1]![j - 1]! + 1 : Math.max(matrix[i - 1]![j]!, matrix[i]![j - 1]!);
    }
  }
  return matrix;
}

export function diffLines(previous: string, current: string): DiffLine[] {
  const a = previous.split("\n");
  const b = current.split("\n");
  const matrix = lcsMatrix(a, b);
  const lines: DiffLine[] = [];
  let i = a.length;
  let j = b.length;
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      lines.push({ type: "equal", text: a[i - 1]! });
      i -= 1;
      j -= 1;
    } else if (matrix[i - 1]![j]! > matrix[i]![j - 1]!) {
      lines.push({ type: "remove", text: a[i - 1]! });
      i -= 1;
    } else {
      lines.push({ type: "add", text: b[j - 1]! });
      j -= 1;
    }
  }
  while (i > 0) {
    lines.push({ type: "remove", text: a[i - 1]! });
    i -= 1;
  }
  while (j > 0) {
    lines.push({ type: "add", text: b[j - 1]! });
    j -= 1;
  }
  return lines.reverse();
}
