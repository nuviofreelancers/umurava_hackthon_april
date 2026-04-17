const pdfParse = require("pdf-parse");

export const parsePDF = async (buffer: Buffer) => {
  const data = await pdfParse(buffer);
  return data.text;
};