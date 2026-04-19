const pdfParse = require("pdf-parse");

export const parsePDF = async (buffer: Buffer): Promise<string> => {
  const data = await pdfParse(buffer);
  return data.text;
};
