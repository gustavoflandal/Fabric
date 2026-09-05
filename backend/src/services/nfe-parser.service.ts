import { XMLParser, XMLValidator } from 'fast-xml-parser';
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

// parseTagValue: false desliga a coerção numérica automática do parser.
// Sem isso, campos textuais com zero à esquerda (CNPJ, número da NFe, código
// de produto, número de lote) são silenciosamente truncados pela lib antes
// mesmo do serviço ver o valor (ex.: "01234567000199" vira 1234567000199).
// Os únicos campos genuinamente numéricos (qCom, vUnCom) são convertidos
// explicitamente com Number() abaixo — não dependemos da coerção implícita.
const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_', parseTagValue: false });

export function parseNfeXml(xml: string): ParsedNfe {
  // Passo explícito de validação de sintaxe: com fast-xml-parser, XML
  // malformado quase nunca lança em parser.parse() — ele silenciosamente
  // interpreta o texto em alguma outra estrutura. XMLValidator.validate()
  // é o jeito confiável de detectar erro de sintaxe genuíno (tag não
  // fechada, nome de tag inválido etc.) e tratá-lo separadamente de um XML
  // bem formado que simplesmente não tem o formato esperado de NFe.
  const validation = XMLValidator.validate(xml);
  if (validation !== true) {
    throw new AppError(400, 'XML inválido ou malformado');
  }

  const json: any = parser.parse(xml);

  // Aceita tanto o envelope completo (nfeProc, com protocolo de autorização
  // anexado) quanto só a NFe isolada — ambos são exportados pelos emissores
  // fiscais dependendo de como o usuário baixou o arquivo.
  const infNFe = json?.nfeProc?.NFe?.infNFe ?? json?.NFe?.infNFe;
  if (!infNFe) {
    throw new AppError(400, 'XML bem formado, mas estrutura de NFe não reconhecida (esperado nfeProc/NFe/infNFe)');
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
