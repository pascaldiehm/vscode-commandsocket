export function encrypt(data: string, password: string): string {
  let encrypted = "";
  let li = 0;
  let ri = data.length - 1;
  let si = 0;
  let sc = (password.charCodeAt(0) & 15) + 1;
  let ei = 0;

  while (li <= ri) {
    let chr = 0;

    if (sc === 0) {
      si = (si + 1) % password.length;
      sc = (password.charCodeAt(si) & 15) + 1;
    }

    if (si & 1) chr = data.charCodeAt(ri--);
    else chr = data.charCodeAt(li++);
    sc--;

    chr ^= password.charCodeAt(ei++);
    if (ei >= password.length) ei = 0;

    encrypted += String.fromCharCode(chr);
  }

  return encrypted;
}

export function decrypt(data: string, password: string): string {
  let decrypted = new Array(data.length);
  let li = 0;
  let ri = data.length - 1;
  let si = 0;
  let sc = (password.charCodeAt(0) & 15) + 1;
  let ei = 0;

  for (let i = 0; i < data.length; i++) {
    let chr = data.charCodeAt(i);

    chr ^= password.charCodeAt(ei++);
    if (ei >= password.length) ei = 0;

    if (sc === 0) {
      si = (si + 1) % password.length;
      sc = (password.charCodeAt(si) & 15) + 1;
    }

    if (si & 1) decrypted[ri--] = String.fromCharCode(chr);
    else decrypted[li++] = String.fromCharCode(chr);
    sc--;
  }

  return decrypted.join("");
}
