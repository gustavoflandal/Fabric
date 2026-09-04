import { XMLParser } from 'fast-xml-parser';
import { AppError } from '../middleware/error.middleware';

/**
 * Parser puro de XML de NFe (modelo 55, layout 4.00) para a tela de
 * Recebimento. Lê só os campos estruturais necessários para pré-preencher o
 * formulário de conferência — NÃO valida assinatura digital nem consulta a
 * SEFAZ (ver spec, seção "Fora de escopo"). A reconciliação de cada item com
 * o pedido de compra é sempre manual no frontend (não há EAN nem código de
 * fornecedor cadastrados hoje — ver spec).
 */

export interface ParsedNfeItem {
  code: string;
  description: string;
  unit: string;
  quantity: number;
  unitValue: number;
  lotNumber?: string;
  manufacturedAt?: string;
  expiresAt?: string;
}

export interface ParsedNfe {
  supplierCnpj: string;
  supplierName: string;
  number: string;
  series: string;
  items: ParsedNfeItem[];
}

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });

export function parseNfeXml(xml: string): ParsedNfe {
  let json: any;
  try {
    json = parser.parse(xml);
  } catch (err) {
    throw new AppError(400, 'XML inválido ou malformado');
  }

  // Aceita tanto o envelope completo (nfeProc, com protocolo de autorização
  // anexado) quanto só a NFe isolada — ambos são exportados pelos emissores
  // fiscais dependendo de como o usuário baixou o arquivo.
  const infNFe = json?.nfeProc?.NFe?.infNFe ?? json?.NFe?.infNFe;
  if (!infNFe) {
    throw new AppError(400, 'XML inválido - estrutura de NFe não reconhecida (esperado nfeProc/NFe/infNFe)');
  }

  const emit = infNFe.emit;
  const ide = infNFe.ide;
  if (!emit?.CNPJ || !ide?.nNF) {
    throw new AppError(400, 'NFe sem emitente ou número da nota');
  }

  const detRaw = infNFe.det;
  const detList = Array.isArray(detRaw) ? detRaw : detRaw ? [detRaw] : [];
  if (detList.length === 0) {
    throw new AppError(400, 'NFe sem itens (det)');
  }

  const items: ParsedNfeItem[] = detList.map((det: any) => {
    const prod = det.prod;
    if (!prod?.cProd || !prod?.xProd || prod?.qCom === undefined) {
      const nItem = det?.['@_nItem'] ?? '?';
      throw new AppError(400, `Item ${nItem} da NFe sem código, descrição ou quantidade`);
    }

    const rastro = prod.rastro;
    const item: ParsedNfeItem = {
      code: String(prod.cProd),
      description: String(prod.xProd),
      unit: String(prod.uCom ?? ''),
      quantity: Number(prod.qCom),
      unitValue: Number(prod.vUnCom ?? 0),
    };
    if (rastro?.nLote) item.lotNumber = String(rastro.nLote);
    if (rastro?.dFab) item.manufacturedAt = String(rastro.dFab);
    if (rastro?.dVal) item.expiresAt = String(rastro.dVal);

    return item;
  });

  return {
    supplierCnpj: String(emit.CNPJ),
    supplierName: String(emit.xNome ?? ''),
    number: String(ide.nNF),
    series: String(ide.serie ?? ''),
    items,
  };
}
