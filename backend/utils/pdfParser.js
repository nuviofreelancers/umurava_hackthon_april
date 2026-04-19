"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parsePDF = void 0;
const pdfParse = require("pdf-parse");
const parsePDF = async (buffer) => {
    const data = await pdfParse(buffer);
    return data.text;
};
exports.parsePDF = parsePDF;
//# sourceMappingURL=pdfParser.js.map