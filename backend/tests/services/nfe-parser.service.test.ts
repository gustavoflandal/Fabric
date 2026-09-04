import { parseNfeXml } from '../../src/services/nfe-parser.service';
import { AppError } from '../../src/middleware/error.middleware';

const VALID_NFE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
  <NFe>
    <infNFe Id="NFe35260112345678000199550010000012345123456789" versao="4.00">
      <ide>
        <cUF>35</cUF>
        <nNF>12345</nNF>
        <serie>1</serie>
        <dhEmi>2026-09-01T10:00:00-03:00</dhEmi>
      </ide>
      <emit>
        <CNPJ>12345678000199</CNPJ>
        <xNome>Fornecedor Exemplo Ltda</xNome>
      </emit>
      <det nItem="1">
        <prod>
          <cProd>PROD-001</cProd>
          <xProd>Parafuso M6x20</xProd>
          <uCom>UN</uCom>
          <qCom>100.0000</qCom>
          <vUnCom>0.50</vUnCom>
          <rastro>
            <nLote>L2026-08</nLote>
            <dFab>2026-08-01</dFab>
            <dVal>2027-08-01</dVal>
          </rastro>
        </prod>
      </det>
      <det nItem="2">
        <prod>
          <cProd>PROD-002</cProd>
          <xProd>Chapa de Aço 2mm</xProd>
          <uCom>KG</uCom>
          <qCom>50.5000</qCom>
          <vUnCom>12.30</vUnCom>
        </prod>
      </det>
    </infNFe>
  </NFe>
</nfeProc>`;

describe('nfe-parser.service — parseNfeXml', () => {
  it('extrai fornecedor, número/série e itens de uma NFe válida', () => {
    const result = parseNfeXml(VALID_NFE_XML);

    expect(result.supplierCnpj).toBe('12345678000199');
    expect(result.supplierName).toBe('Fornecedor Exemplo Ltda');
    expect(result.number).toBe('12345');
    expect(result.series).toBe('1');
    expect(result.items).toHaveLength(2);
  });

  it('extrai os campos de cada item, incluindo lote quando presente', () => {
    const result = parseNfeXml(VALID_NFE_XML);

    expect(result.items[0]).toEqual({
      code: 'PROD-001',
      description: 'Parafuso M6x20',
      unit: 'UN',
      quantity: 100,
      unitValue: 0.5,
      lotNumber: 'L2026-08',
      manufacturedAt: '2026-08-01',
      expiresAt: '2027-08-01',
    });
  });

  it('item sem grupo rastro não traz campos de lote', () => {
    const result = parseNfeXml(VALID_NFE_XML);

    expect(result.items[1]).toEqual({
      code: 'PROD-002',
      description: 'Chapa de Aço 2mm',
      unit: 'KG',
      quantity: 50.5,
      unitValue: 12.3,
    });
  });

  it('NFe com um único item (det não vem como array) ainda funciona', () => {
    const singleItemXml = VALID_NFE_XML.replace(
      /<det nItem="2">[\s\S]*?<\/det>\s*/,
      ''
    );

    const result = parseNfeXml(singleItemXml);

    expect(result.items).toHaveLength(1);
    expect(result.items[0].code).toBe('PROD-001');
  });

  it('rejeita XML malformado com AppError 400', () => {
    expect(() => parseNfeXml('<not><valid</xml>')).toThrow(AppError);
    expect(() => parseNfeXml('<not><valid</xml>')).toThrow(/inválido|malformado/i);
  });

  it('rejeita XML bem formado mas sem estrutura de NFe com AppError 400', () => {
    expect(() => parseNfeXml('<algumaCoisa><outra>valor</outra></algumaCoisa>')).toThrow(
      AppError
    );
  });

  it('rejeita NFe sem itens com AppError 400', () => {
    const noItemsXml = VALID_NFE_XML.replace(/<det nItem="1">[\s\S]*?<\/nfeProc>/, '</infNFe></NFe></nfeProc>');

    expect(() => parseNfeXml(noItemsXml)).toThrow(AppError);
  });
});
