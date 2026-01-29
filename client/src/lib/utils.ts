import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const formatBrazilianPhone = (phone: string | undefined): string => {
  if (!phone) return "";
  const cleaned = phone.replace(/\D/g, "");

  // Format based on length (10 or 11 digits)
  if (cleaned.length === 11) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
  } else if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 6)}-${cleaned.slice(6)}`;
  } else if (cleaned.length === 13 && cleaned.startsWith("55")) { // Country code handling
    const ddd = cleaned.slice(2, 4);
    const nine = cleaned.slice(4, 5);
    const part1 = cleaned.slice(4, 9);
    const part2 = cleaned.slice(9);
    if (cleaned.length === 13) return `(${ddd}) ${part1}-${part2}`;
    // Fallback
    return phone;
  }

  return phone;
};

export const getCityStateFromPhone = (phone: string | undefined): string | null => {
  if (!phone) return null;
  const clean = phone.replace(/\D/g, '');
  let ddd = '';

  // Check if starts with country code 55 (e.g. 5511999999999) -> length typically 12 or 13
  if (clean.startsWith('55') && clean.length >= 4) {
    ddd = clean.substring(2, 4);
  } else if (clean.length >= 2) {
    // Assuming starts with DDD if no country code or just local number
    ddd = clean.substring(0, 2);
  }

  if (!ddd) return null;

  const dddMap: Record<string, string> = {
    '11': 'São Paulo/SP', '12': 'Vale do Paraíba/SP', '13': 'Santos/SP', '14': 'Bauru/SP', '15': 'Sorocaba/SP',
    '16': 'Ribeirão Preto/SP', '17': 'S.J. Rio Preto/SP', '18': 'Pres. Prudente/SP', '19': 'Campinas/SP',
    '21': 'Rio de Janeiro/RJ', '22': 'Campos/RJ', '24': 'Volta Redonda/RJ', '27': 'Vitória/ES', '28': 'Cachoeiro/ES',
    '31': 'Belo Horizonte/MG', '32': 'Juiz de Fora/MG', '33': 'Gov. Valadares/MG', '34': 'Uberlândia/MG',
    '35': 'Poços de Caldas/MG', '37': 'Divinópolis/MG', '38': 'Montes Claros/MG',
    '41': 'Curitiba/PR', '42': 'Ponta Grossa/PR', '43': 'Londrina/PR', '44': 'Maringá/PR', '45': 'Foz do Iguaçu/PR',
    '46': 'Francisco Beltrão/PR', '47': 'Joinville/SC', '48': 'Florianópolis/SC', '49': 'Chapecó/SC',
    '51': 'Porto Alegre/RS', '53': 'Pelotas/RS', '54': 'Caxias do Sul/RS', '55': 'Santa Maria/RS',
    '61': 'Brasília/DF', '62': 'Goiânia/GO', '63': 'Palmas/TO', '64': 'Rio Verde/GO',
    '65': 'Cuiabá/MT', '66': 'Rondonópolis/MT', '67': 'Campo Grande/MS',
    '68': 'Rio Branco/AC', '69': 'Porto Velho/RO',
    '71': 'Salvador/BA', '73': 'Ilhéus/BA', '74': 'Juazeiro/BA', '75': 'Feira de Santana/BA', '77': 'Barreiras/BA', '79': 'Aracaju/SE',
    '81': 'Recife/PE', '82': 'Maceió/AL', '83': 'João Pessoa/PB', '84': 'Natal/RN', '85': 'Fortaleza/CE', '86': 'Teresina/PI', '87': 'Petrolina/PE', '88': 'Juazeiro do Norte/CE', '89': 'Picos/PI',
    '91': 'Belém/PA', '92': 'Manaus/AM', '93': 'Santarém/PA', '94': 'Marabá/PA', '95': 'Boa Vista/RR', '96': 'Macapá/AP', '97': 'Coari/AM', '98': 'São Luís/MA', '99': 'Imperatriz/MA'
  };

  return dddMap[ddd] || null;
};

export const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};
