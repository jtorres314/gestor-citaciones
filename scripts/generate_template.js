import { 
  Document, 
  Packer, 
  Paragraph, 
  TextRun, 
  Table, 
  TableRow, 
  TableCell, 
  WidthType, 
  AlignmentType, 
  BorderStyle,
  ShadingType
} from 'docx';
import fs from 'fs';
import path from 'path';

async function generateTemplate() {
  const blackBorder = { style: BorderStyle.SINGLE, size: 4, color: "000000" };

  const nuncCells = Array.from({ length: 21 }, (_, i) => 
    new TableCell({
      width: { size: 100 / 21, type: WidthType.PERCENTAGE },
      borders: { top: blackBorder, bottom: blackBorder, left: blackBorder, right: blackBorder },
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: `{NUNC_${i + 1}}`, size: 14, bold: true, font: "Calibri" })]
        })
      ]
    })
  );

  const nuncTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ children: nuncCells })
    ]
  });

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: { top: 720, bottom: 720, left: 720, right: 720 }
          }
        },
        children: [
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [
              new TextRun({ text: "Número Único de Noticia Criminal: {NUNC}", bold: true, size: 18, font: "Calibri" })
            ]
          }),
          nuncTable,
          new Paragraph({ text: "", spacing: { after: 100 } }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 100, type: WidthType.PERCENTAGE },
                    shading: { fill: "F2F2F2", type: ShadingType.CLEAR },
                    borders: { top: blackBorder, bottom: blackBorder, left: blackBorder, right: blackBorder },
                    children: [
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [
                          new TextRun({ text: "CITACIÓN – FPJ - 35\n", bold: true, size: 22, font: "Calibri" }),
                          new TextRun({ text: "Este formato será utilizado por Policía Judicial", size: 16, italics: true, font: "Calibri" })
                        ]
                      })
                    ]
                  })
                ]
              }),
              new TableRow({
                children: [
                  new TableCell({
                    borders: { top: blackBorder, bottom: blackBorder, left: blackBorder, right: blackBorder },
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({ text: "Departamento: ", bold: true, size: 16, font: "Calibri" }),
                          new TextRun({ text: "{DEPARTAMENTO}   ", size: 16, font: "Calibri" }),
                          new TextRun({ text: "Municipio: ", bold: true, size: 16, font: "Calibri" }),
                          new TextRun({ text: "{MUNICIPIO}   ", size: 16, font: "Calibri" }),
                          new TextRun({ text: "Fecha: ", bold: true, size: 16, font: "Calibri" }),
                          new TextRun({ text: "{FECHA_EXPEDICION}   ", size: 16, font: "Calibri" }),
                          new TextRun({ text: "Hora: ", bold: true, size: 16, font: "Calibri" }),
                          new TextRun({ text: "{HORA_EXPEDICION}", size: 16, font: "Calibri" })
                        ]
                      })
                    ]
                  })
                ]
              })
            ]
          }),
          new Paragraph({ text: "", spacing: { after: 100 } }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 25, type: WidthType.PERCENTAGE },
                    borders: { top: blackBorder, bottom: blackBorder, left: blackBorder, right: blackBorder },
                    children: [new Paragraph({ children: [new TextRun({ text: "Señor (a)", bold: true, size: 18, font: "Calibri" })] })]
                  }),
                  new TableCell({
                    width: { size: 75, type: WidthType.PERCENTAGE },
                    borders: { top: blackBorder, bottom: blackBorder, left: blackBorder, right: blackBorder },
                    children: [new Paragraph({ children: [new TextRun({ text: "{NOMBRE}", bold: true, size: 18, font: "Calibri" })] })]
                  })
                ]
              }),
              new TableRow({
                children: [
                  new TableCell({
                    borders: { top: blackBorder, bottom: blackBorder, left: blackBorder, right: blackBorder },
                    children: [new Paragraph({ children: [new TextRun({ text: "Dirección", bold: true, size: 18, font: "Calibri" })] })]
                  }),
                  new TableCell({
                    borders: { top: blackBorder, bottom: blackBorder, left: blackBorder, right: blackBorder },
                    children: [new Paragraph({ children: [new TextRun({ text: "{DIRECCION}", size: 18, font: "Calibri" })] })]
                  })
                ]
              }),
              new TableRow({
                children: [
                  new TableCell({
                    borders: { top: blackBorder, bottom: blackBorder, left: blackBorder, right: blackBorder },
                    children: [new Paragraph({ children: [new TextRun({ text: "Correo", bold: true, size: 18, font: "Calibri" })] })]
                  }),
                  new TableCell({
                    borders: { top: blackBorder, bottom: blackBorder, left: blackBorder, right: blackBorder },
                    children: [new Paragraph({ children: [new TextRun({ text: "{CORREO}", size: 18, font: "Calibri" })] })]
                  })
                ]
              }),
              new TableRow({
                children: [
                  new TableCell({
                    borders: { top: blackBorder, bottom: blackBorder, left: blackBorder, right: blackBorder },
                    children: [new Paragraph({ children: [new TextRun({ text: "Ciudad / Teléfono", bold: true, size: 18, font: "Calibri" })] })]
                  }),
                  new TableCell({
                    borders: { top: blackBorder, bottom: blackBorder, left: blackBorder, right: blackBorder },
                    children: [new Paragraph({ children: [new TextRun({ text: "{CIUDAD} / {TELEFONO}", size: 18, font: "Calibri" })] })]
                  })
                ]
              })
            ]
          }),
          new Paragraph({ text: "", spacing: { after: 100 } }),
          new Paragraph({
            children: [
              new TextRun({ text: "ASUNTO: CITACIÓN PARA COMPARECENCIA", bold: true, size: 18, font: "Calibri" })
            ]
          }),
          new Paragraph({ text: "", spacing: { after: 100 } }),
          new Paragraph({
            children: [
              new TextRun({ text: "Se requiere su presencia el día ", size: 18, font: "Calibri" }),
              new TextRun({ text: "{FECHA_COMPARECENCIA}", bold: true, size: 18, font: "Calibri" }),
              new TextRun({ text: " a las ", size: 18, font: "Calibri" }),
              new TextRun({ text: "{HORA_COMPARECENCIA}", bold: true, size: 18, font: "Calibri" }),
              new TextRun({ text: " en las instalaciones de ", size: 18, font: "Calibri" }),
              new TextRun({ text: "{INSTALACIONES}", bold: true, size: 18, font: "Calibri" }),
              new TextRun({ text: ", ubicadas en ", size: 18, font: "Calibri" }),
              new TextRun({ text: "{DIRECCION_INSTALACIONES}", bold: true, size: 18, font: "Calibri" }),
              new TextRun({ text: " con el fin de llevar a cabo la diligencia de ", size: 18, font: "Calibri" }),
              new TextRun({ text: "{MOTIVO}", bold: true, size: 18, font: "Calibri" }),
              new TextRun({ text: " dentro de la investigación por la Noticia Criminal No. ", size: 18, font: "Calibri" }),
              new TextRun({ text: "{NUNC}", bold: true, size: 18, font: "Calibri" }),
              new TextRun({ text: " a cargo de la Fiscalía ", size: 18, font: "Calibri" }),
              new TextRun({ text: "{FISCAL}", bold: true, size: 18, font: "Calibri" }),
              new TextRun({ text: ".", size: 18, font: "Calibri" })
            ]
          }),
          new Paragraph({ text: "", spacing: { after: 100 } }),
          new Paragraph({
            children: [
              new TextRun({ text: "Asistencia con Abogado: ", bold: true, size: 18, font: "Calibri" }),
              new TextRun({ text: "{REQUIERE_ABOGADO}", size: 18, font: "Calibri" })
            ]
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "Observaciones / Indicaciones: ", bold: true, size: 18, font: "Calibri" }),
              new TextRun({ text: "{OBSERVACIONES}", size: 18, font: "Calibri" })
            ]
          }),
          new Paragraph({ text: "", spacing: { after: 200 } }),
          new Paragraph({
            children: [
              new TextRun({ text: "Atentamente,", size: 18, font: "Calibri" })
            ]
          }),
          new Paragraph({ text: "", spacing: { after: 300 } }),
          new Paragraph({
            children: [
              new TextRun({ text: "{INVESTIGADOR}\n", bold: true, size: 18, font: "Calibri" }),
              new TextRun({ text: "{CARGO} - {GRUPO_INVESTIGADOR}\n", size: 16, font: "Calibri" }),
              new TextRun({ text: "{ENTIDAD_INVESTIGADOR}\n", size: 16, font: "Calibri" }),
              new TextRun({ text: "Teléfono: {TELEFONO_INVESTIGADOR} | Correo: {CORREO_INVESTIGADOR}", size: 16, font: "Calibri" })
            ]
          })
        ]
      }
    ]
  });

  const buffer = await Packer.toBuffer(doc);
  const outPath = path.join(process.cwd(), 'public', 'PLANTILLA CITACION.docx');
  fs.writeFileSync(outPath, buffer);
  console.log('Template created at:', outPath);
}

generateTemplate().catch(console.error);
