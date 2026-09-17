const fs = require('fs');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');

function processTemplate() {
  const inputBuffer = fs.readFileSync('PLANTILLA CITACION.docx');
  const zip = new PizZip(inputBuffer);
  let xml = zip.file('word/document.xml').asText();

  // 1. Table 0 (NUNC digits)
  // Let's find Table 0 Row 1
  const t0Match = xml.match(/<w:tbl[\s\S]*?<\/w:tbl>/);
  if (t0Match) {
    let t0 = t0Match[0];
    const rows = t0.match(/<w:tr[\s\S]*?<\/w:tr>/g);
    if (rows && rows.length >= 2) {
      let r1 = rows[1];
      const cells = r1.match(/<w:tc[\s\S]*?<\/w:tc>/g);
      if (cells && cells.length === 35) {
        let newR1 = r1;
        // cells 14 to 34 are the 21 digits
        for (let i = 14; i <= 34; i++) {
          const digitIndex = i - 14;
          const oldCell = cells[i];
          const newCell = oldCell.replace(
            /<\/w:pPr>[\s\S]*?<\/w:p>/,
            `</w:pPr><w:r><w:rPr><w:rFonts w:eastAsia="Tahoma" w:cs="Arial"/><w:b/><w:sz w:val="18"/><w:szCs w:val="16"/></w:rPr><w:t>{NUNC_${digitIndex}}</w:t></w:r></w:p>`
          );
          newR1 = newR1.replace(oldCell, newCell);
        }
        t0 = t0.replace(r1, newR1);
        xml = xml.replace(t0Match[0], t0);
      }
    }
  }

  // 2. Table 1 (Encabezado FPJ-35)
  // Find Table 1
  const allTables = xml.split('</w:tbl>');
  if (allTables.length > 1) {
    let t1 = allTables[1];
    const rows = t1.match(/<w:tr[\s\S]*?<\/w:tr>/g);
    if (rows && rows.length >= 2) {
      let r1 = rows[1];
      const cells = r1.match(/<w:tc[\s\S]*?<\/w:tc>/g);
      if (cells && cells.length === 13) {
        // Cell 1: Departamento
        let c1 = cells[1].replace(/<\/w:pPr>[\s\S]*?<\/w:p>/, `</w:pPr><w:r><w:rPr><w:rFonts w:eastAsia="Tahoma" w:cs="Arial"/><w:b/><w:sz w:val="18"/><w:szCs w:val="16"/></w:rPr><w:t>{DEPARTAMENTO}</w:t></w:r></w:p>`);
        // Cell 3: Municipio
        let c3 = cells[3].replace(/<\/w:pPr>[\s\S]*?<\/w:p>/, `</w:pPr><w:r><w:rPr><w:rFonts w:eastAsia="Tahoma" w:cs="Arial"/><w:b/><w:sz w:val="18"/><w:szCs w:val="16"/></w:rPr><w:t>{MUNICIPIO}</w:t></w:r></w:p>`);
        // Cell 5: Año (o fecha completa)
        let c5 = cells[5].replace(/<\/w:pPr>[\s\S]*?<\/w:p>/, `</w:pPr><w:r><w:rPr><w:rFonts w:eastAsia="Tahoma" w:cs="Arial"/><w:b/><w:sz w:val="16"/><w:szCs w:val="14"/></w:rPr><w:t>{FECHA_EXP_ANO}</w:t></w:r></w:p>`);
        // Cell 6: Mes
        let c6 = cells[6].replace(/<\/w:pPr>[\s\S]*?<\/w:p>/, `</w:pPr><w:r><w:rPr><w:rFonts w:eastAsia="Tahoma" w:cs="Arial"/><w:b/><w:sz w:val="16"/><w:szCs w:val="14"/></w:rPr><w:t>{FECHA_EXP_MES}</w:t></w:r></w:p>`);
        // Cell 7: Día
        let c7 = cells[7].replace(/<\/w:pPr>[\s\S]*?<\/w:p>/, `</w:pPr><w:r><w:rPr><w:rFonts w:eastAsia="Tahoma" w:cs="Arial"/><w:b/><w:sz w:val="16"/><w:szCs w:val="14"/></w:rPr><w:t>{FECHA_EXP_DIA}</w:t></w:r></w:p>`);
        // Cell 9: H1
        let c9 = cells[9].replace(/<\/w:pPr>[\s\S]*?<\/w:p>/, `</w:pPr><w:r><w:rPr><w:rFonts w:eastAsia="Tahoma" w:cs="Arial"/><w:b/><w:sz w:val="16"/><w:szCs w:val="14"/></w:rPr><w:t>{HORA_EXP_H1}</w:t></w:r></w:p>`);
        // Cell 10: H2
        let c10 = cells[10].replace(/<\/w:pPr>[\s\S]*?<\/w:p>/, `</w:pPr><w:r><w:rPr><w:rFonts w:eastAsia="Tahoma" w:cs="Arial"/><w:b/><w:sz w:val="16"/><w:szCs w:val="14"/></w:rPr><w:t>{HORA_EXP_H2}</w:t></w:r></w:p>`);
        // Cell 11: M1
        let c11 = cells[11].replace(/<\/w:pPr>[\s\S]*?<\/w:p>/, `</w:pPr><w:r><w:rPr><w:rFonts w:eastAsia="Tahoma" w:cs="Arial"/><w:b/><w:sz w:val="16"/><w:szCs w:val="14"/></w:rPr><w:t>{HORA_EXP_M1}</w:t></w:r></w:p>`);
        // Cell 12: M2
        let c12 = cells[12].replace(/<\/w:pPr>[\s\S]*?<\/w:p>/, `</w:pPr><w:r><w:rPr><w:rFonts w:eastAsia="Tahoma" w:cs="Arial"/><w:b/><w:sz w:val="16"/><w:szCs w:val="14"/></w:rPr><w:t>{HORA_EXP_M2}</w:t></w:r></w:p>`);

        let newR1 = r1.replace(cells[1], c1)
                      .replace(cells[3], c3)
                      .replace(cells[5], c5)
                      .replace(cells[6], c6)
                      .replace(cells[7], c7)
                      .replace(cells[9], c9)
                      .replace(cells[10], c10)
                      .replace(cells[11], c11)
                      .replace(cells[12], c12);
        xml = xml.replace(r1, newR1);
      }
    }
  }

  // 3. Table 2 (Destinatario)
  // Señor (a), Dirección, Correo electrónico, Ciudad
  // Cell 1 of Row 0: Señor(a) -> {NOMBRE}
  // Cell 1 of Row 1: Dirección -> {DIRECCION}
  // Cell 1 of Row 2: Correo electrónico -> {CORREO}
  // Cell 1 of Row 3: Ciudad -> {CIUDAD_Y_TELEFONO}
  const table2Match = xml.match(/<w:tr[\s\S]*?Señor \(a\)[\s\S]*?<\/w:tr>[\s\S]*?<w:tr[\s\S]*?Dirección[\s\S]*?<\/w:tr>[\s\S]*?<w:tr[\s\S]*?Correo electrónico[\s\S]*?<\/w:tr>[\s\S]*?<w:tr[\s\S]*?Ciudad[\s\S]*?<\/w:tr>/);
  if (table2Match) {
    let t2 = table2Match[0];
    const rows = t2.match(/<w:tr[\s\S]*?<\/w:tr>/g);
    if (rows && rows.length >= 4) {
      // Row 0 (Señor a)
      let r0 = rows[0];
      const r0cells = r0.match(/<w:tc[\s\S]*?<\/w:tc>/g);
      if (r0cells && r0cells.length >= 2) {
        let newCell = r0cells[1].replace(/<\/w:pPr>[\s\S]*?<\/w:p>/, `</w:pPr><w:r><w:rPr><w:rFonts w:eastAsia="Tahoma" w:cs="Arial"/><w:b/><w:sz w:val="20"/><w:szCs w:val="18"/></w:rPr><w:t>{NOMBRE}</w:t></w:r></w:p>`);
        t2 = t2.replace(r0, r0.replace(r0cells[1], newCell));
      }

      // Row 1 (Dirección)
      let r1 = rows[1];
      const r1cells = r1.match(/<w:tc[\s\S]*?<\/w:tc>/g);
      if (r1cells && r1cells.length >= 2) {
        let newCell = r1cells[1].replace(/<\/w:pPr>[\s\S]*?<\/w:p>/, `</w:pPr><w:r><w:rPr><w:rFonts w:eastAsia="Tahoma" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="16"/></w:rPr><w:t>{DIRECCION}</w:t></w:r></w:p>`);
        t2 = t2.replace(r1, r1.replace(r1cells[1], newCell));
      }

      // Row 2 (Correo electrónico)
      let r2 = rows[2];
      const r2cells = r2.match(/<w:tc[\s\S]*?<\/w:tc>/g);
      if (r2cells && r2cells.length >= 2) {
        let newCell = r2cells[1].replace(/<\/w:pPr>[\s\S]*?<\/w:p>/, `</w:pPr><w:r><w:rPr><w:rFonts w:eastAsia="Tahoma" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="16"/></w:rPr><w:t>{CORREO}</w:t></w:r></w:p>`);
        t2 = t2.replace(r2, r2.replace(r2cells[1], newCell));
      }

      // Row 3 (Ciudad)
      let r3 = rows[3];
      const r3cells = r3.match(/<w:tc[\s\S]*?<\/w:tc>/g);
      if (r3cells && r3cells.length >= 2) {
        let newCell = r3cells[1].replace(/<\/w:pPr>[\s\S]*?<\/w:p>/, `</w:pPr><w:r><w:rPr><w:rFonts w:eastAsia="Tahoma" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="16"/></w:rPr><w:t>{CIUDAD_Y_TELEFONO}</w:t></w:r></w:p>`);
        t2 = t2.replace(r3, r3.replace(r3cells[1], newCell));
      }

      xml = xml.replace(table2Match[0], t2);
    }
  }

  // 4. Table 3 (Paragraph comparecencia - unified tag {MOTIVO_CITACION})
  const pCompareceMatch = xml.match(/<w:p [^>]*>[^<]*<w:pPr>[\s\S]*?Se solicita comparece[\s\S]*?<\/w:p>/);
  if (pCompareceMatch) {
    const oldP = pCompareceMatch[0];
    const pPrMatch = oldP.match(/<w:pPr>[\s\S]*?<\/w:pPr>/);
    const pPr = pPrMatch ? pPrMatch[0] : '<w:pPr><w:ind w:left="328"/></w:pPr>';
    const newP = `<w:p w:rsidR="005378B2" w:rsidRDefault="005378B2">${pPr}<w:r><w:rPr><w:rFonts w:eastAsia="Tahoma" w:cs="Arial"/><w:sz w:val="22"/><w:szCs w:val="16"/></w:rPr><w:t>{MOTIVO_CITACION}</w:t></w:r></w:p>`;
    xml = xml.replace(oldP, newP);
  }

  // 5. Table 4 (Debe asistir con abogado SI / NO)
  const t4Match = xml.match(/<w:tr[\s\S]*?Debe asistir con abogado[\s\S]*?<\/w:tr>/);
  if (t4Match) {
    let r = t4Match[0];
    const cells = r.match(/<w:tc[\s\S]*?<\/w:tc>/g);
    if (cells && cells.length >= 5) {
      // Cell 2: checkbox for SI
      let c2 = cells[2].replace(/<\/w:pPr>[\s\S]*?<\/w:p>/, `</w:pPr><w:r><w:rPr><w:rFonts w:eastAsia="Tahoma" w:cs="Arial"/><w:b/><w:sz w:val="22"/><w:szCs w:val="16"/></w:rPr><w:t>{REQUIERE_SI}</w:t></w:r></w:p>`);
      // Cell 4: checkbox for NO
      let c4 = cells[4].replace(/<\/w:pPr>[\s\S]*?<\/w:p>/, `</w:pPr><w:r><w:rPr><w:rFonts w:eastAsia="Tahoma" w:cs="Arial"/><w:b/><w:sz w:val="22"/><w:szCs w:val="16"/></w:rPr><w:t>{REQUIERE_NO}</w:t></w:r></w:p>`);
      let newR = r.replace(cells[2], c2).replace(cells[4], c4);
      xml = xml.replace(r, newR);
    }
  }

  // 6. Table 6 (OBSERVACIONES)
  const t6Match = xml.match(/<w:tr[\s\S]*?OBSERVACIONES[\s\S]*?<\/w:tr>[\s\S]*?<w:tr[\s\S]*?<\/w:tr>/);
  if (t6Match) {
    let t6 = t6Match[0];
    const rows = t6.match(/<w:tr[\s\S]*?<\/w:tr>/g);
    if (rows && rows.length >= 2) {
      let r1 = rows[1];
      const cells = r1.match(/<w:tc[\s\S]*?<\/w:tc>/g);
      if (cells && cells.length >= 1) {
        let newCell = cells[0].replace(/<\/w:pPr>[\s\S]*?<\/w:p>/, `</w:pPr><w:r><w:rPr><w:rFonts w:eastAsia="Tahoma" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="16"/></w:rPr><w:t>{OBSERVACIONES}</w:t></w:r></w:p>`);
        t6 = t6.replace(r1, r1.replace(cells[0], newCell));
        xml = xml.replace(t6Match[0], t6);
      }
    }
  }

  // 7. Table 7 (PERSONA QUE REALIZA LA CITACIÓN)
  const t7Match = xml.match(/<w:tr[\s\S]*?PERSONA QUE REALIZA LA CITACI Ó N[\s\S]*?<\/w:tr>[\s\S]*?<w:tr[\s\S]*?Nombres y Apellidos[\s\S]*?<\/w:tr>[\s\S]*?<w:tr[\s\S]*?<\/w:tr>[\s\S]*?<w:tr[\s\S]*?Correo Electrónico[\s\S]*?<\/w:tr>[\s\S]*?<w:tr[\s\S]*?<\/w:tr>/);
  if (t7Match) {
    let t7 = t7Match[0];
    const rows = t7.match(/<w:tr[\s\S]*?<\/w:tr>/g);
    if (rows && rows.length >= 5) {
      // Row 2: Nombres / Entidad / Grupo
      let r2 = rows[2];
      const r2cells = r2.match(/<w:tc[\s\S]*?<\/w:tc>/g);
      if (r2cells && r2cells.length >= 3) {
        let c0 = r2cells[0].replace(/<\/w:pPr>[\s\S]*?<\/w:p>/, `</w:pPr><w:r><w:rPr><w:rFonts w:eastAsia="Tahoma" w:cs="Arial"/><w:b/><w:sz w:val="18"/><w:szCs w:val="16"/></w:rPr><w:t>{INVESTIGADOR}</w:t></w:r></w:p>`);
        let c1 = r2cells[1].replace(/<\/w:pPr>[\s\S]*?<\/w:p>/, `</w:pPr><w:r><w:rPr><w:rFonts w:eastAsia="Tahoma" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="16"/></w:rPr><w:t>{ENTIDAD_INVESTIGADOR}</w:t></w:r></w:p>`);
        let c2 = r2cells[2].replace(/<\/w:pPr>[\s\S]*?<\/w:p>/, `</w:pPr><w:r><w:rPr><w:rFonts w:eastAsia="Tahoma" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="16"/></w:rPr><w:t>{UNIDAD}</w:t></w:r></w:p>`);
        t7 = t7.replace(r2, r2.replace(r2cells[0], c0).replace(r2cells[1], c1).replace(r2cells[2], c2));
      }

      // Row 4: Correo Electrónico
      let r4 = rows[4];
      const r4cells = r4.match(/<w:tc[\s\S]*?<\/w:tc>/g);
      if (r4cells && r4cells.length >= 1) {
        let c0 = r4cells[0].replace(/<\/w:pPr>[\s\S]*?<\/w:p>/, `</w:pPr><w:r><w:rPr><w:rFonts w:eastAsia="Tahoma" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="16"/></w:rPr><w:t>{CORREO_INVESTIGADOR}</w:t></w:r></w:p>`);
        t7 = t7.replace(r4, r4.replace(r4cells[0], c0));
      }

      xml = xml.replace(t7Match[0], t7);
    }
  }

  zip.file('word/document.xml', xml);
  const outBuffer = zip.generate({ type: 'nodebuffer' });
  
  // Save to public/PLANTILLA CITACION.docx
  fs.writeFileSync('public/PLANTILLA CITACION.docx', outBuffer);
  console.log('Saved processed template to public/PLANTILLA CITACION.docx (size:', outBuffer.length, 'bytes)');

  // Test with Docxtemplater!
  const testZip = new PizZip(outBuffer);
  const doc = new Docxtemplater(testZip, { paragraphLoop: true, linebreaks: true });
  doc.render({
    NOMBRE: 'JUAN VALDEZ con CC 12345678',
    DIRECCION: 'Calle 10 # 20-30',
    CORREO: 'juan@test.com',
    CIUDAD_Y_TELEFONO: 'Cartagena - Tel: 3001234567',
    DEPARTAMENTO: 'Bolívar',
    MUNICIPIO: 'Cartagena',
    FECHA_EXP_ANO: '2026',
    FECHA_EXP_MES: '09',
    FECHA_EXP_DIA: '16',
    HORA_EXP_H1: '1',
    HORA_EXP_H2: '4',
    HORA_EXP_M1: '3',
    HORA_EXP_M2: '0',
    FECHA_COMPARECENCIA: '18 de Septiembre de 2026',
    HORA_COMPARECENCIA: '09:00 AM',
    INSTALACIONES: 'Sede Canapote CTI',
    DIRECCION_INSTALACIONES: 'Cra 14 # 60-20',
    MOTIVO: 'Ampliación de denuncia',
    REQUIERE_SI: '',
    REQUIERE_NO: 'X',
    OBSERVACIONES: 'Presentar documento original.',
    INVESTIGADOR: 'Pedro Pérez',
    ENTIDAD_INVESTIGADOR: 'CTI - FGN',
    UNIDAD: 'Patrimonio Económico',
    CORREO_INVESTIGADOR: 'pedro.perez@fiscalia.gov.co',
    NUNC_0: '1', NUNC_1: '3', NUNC_2: '0', NUNC_3: '0', NUNC_4: '1',
    NUNC_5: '6', NUNC_6: '0', NUNC_7: '0', NUNC_8: '0', NUNC_9: '1',
    NUNC_10: '2', NUNC_11: '3', NUNC_12: '2', NUNC_13: '0', NUNC_14: '2',
    NUNC_15: '6', NUNC_16: '0', NUNC_17: '0', NUNC_18: '1', NUNC_19: '2', NUNC_20: '3'
  });
  console.log('Docxtemplater test passed without errors!');
}

processTemplate();
