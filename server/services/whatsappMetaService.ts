import { Request, Response } from 'express';

export type MetaConnectionStatus = 'CONECTADO' | 'TOKEN_INVALIDO' | 'PERMISSAO_INSUFICIENTE' | 'NUMERO_NAO_VINCULADO' | 'ERRO';

export interface WhatsappMetaConfigEntity {
  company_id: number;
  business_manager_id: string;
  waba_id: string;
  phone_number_id: string;
  meta_app_id: string;
  meta_app_secret: string;
  access_token: string;
  verify_token: string;
  webhook_url: string;
  callback_url: string;
  api_version: string;
  provider: 'api_plus';
  channel_type: 'whatsapp';
  connection_mode: 'qr_code';
  instance_key: string;
  instance_name: string;
  whatsapp_number: string;
  id_numero_meta: string;
  id_conta_comercial: string;
  sandbox_mode: boolean;
  region: string;
  receive_messages: boolean;
  receive_status: boolean;
  receive_contacts: boolean;
  receive_chat_updates: boolean;
  subscription_fields: string[];
  status: 'active' | 'inactive';
}

const DEFAULT_SUBSCRIPTION_FIELDS = [
  'messages',
  'messaging_postbacks',
  'message_status',
  'message_reactions'
];

const normalizePhoneNumberId = (value: unknown): string => String(value ?? '').trim();

export const validateWhatsappMetaPayload = (payload: Record<string, any>) => {
  const errors: string[] = [];

  const accessToken = String(payload.whatsapp_meta_access_token || '').trim();
  const phoneNumberId = normalizePhoneNumberId(payload.whatsapp_meta_phone_number_id);
  const verifyToken = String(payload.whatsapp_meta_verify_token || '').trim();
  const appId = String(payload.whatsapp_meta_app_id || '').trim();
  const appSecret = String(payload.whatsapp_meta_app_secret || '').trim();
  const instanceKey = String(payload.whatsapp_meta_instance_key || '').trim();

  if (!accessToken) errors.push('Access Token permanente é obrigatório.');
  if (!phoneNumberId) errors.push('Phone Number ID é obrigatório.');
  if (!verifyToken) errors.push('Verify Token é obrigatório.');
  if (!appId) errors.push('App ID é obrigatório.');
  if (!appSecret) errors.push('App Secret é obrigatório.');
  if (!instanceKey) errors.push('Nome da instância (instance_key) é obrigatório.');

  if (accessToken && !accessToken.startsWith('EAA')) {
    errors.push('Access Token inválido: deve iniciar com "EAA".');
  }

  if (phoneNumberId && !/^\d+$/.test(phoneNumberId)) {
    errors.push('Phone Number ID inválido: apenas números são permitidos.');
  }

  const subscriptionFields = Array.isArray(payload.whatsapp_meta_subscription_fields)
    ? payload.whatsapp_meta_subscription_fields
    : DEFAULT_SUBSCRIPTION_FIELDS;

  const validFields = new Set(DEFAULT_SUBSCRIPTION_FIELDS);
  for (const field of subscriptionFields) {
    if (!validFields.has(field)) {
      errors.push(`Subscription field inválido: ${field}.`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    subscriptionFields
  };
};

export const validateMetaConnection = async ({
  accessToken,
  apiVersion,
  wabaId,
  phoneNumberId
}: {
  accessToken: string;
  apiVersion: string;
  wabaId: string;
  phoneNumberId: string;
}): Promise<{ status: MetaConnectionStatus; details: any }> => {
  const v = apiVersion || 'v18.0';

  try {
    const meUrl = `https://graph.facebook.com/${v}/me?access_token=${encodeURIComponent(accessToken)}`;
    const tokenResponse = await fetch(meUrl);
    const tokenData = await tokenResponse.json().catch(() => ({}));

    if (!tokenResponse.ok) {
      const message = String(tokenData?.error?.message || '').toLowerCase();
      if (message.includes('permissions') || message.includes('permission')) {
        return { status: 'PERMISSAO_INSUFICIENTE', details: tokenData };
      }
      return { status: 'TOKEN_INVALIDO', details: tokenData };
    }

    if (!wabaId) {
      return { status: 'NUMERO_NAO_VINCULADO', details: { error: 'WABA ID não informado.' } };
    }

    const subscribeUrl = `https://graph.facebook.com/${v}/${encodeURIComponent(wabaId)}/subscribed_apps`;
    const subResponse = await fetch(subscribeUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        access_token: accessToken,
        subscribed_fields: DEFAULT_SUBSCRIPTION_FIELDS
      })
    });
    const subData = await subResponse.json().catch(() => ({}));

    if (!subResponse.ok) {
      const message = String(subData?.error?.message || '').toLowerCase();
      if (message.includes('permission')) {
        return { status: 'PERMISSAO_INSUFICIENTE', details: subData };
      }
      if (message.includes('phone') || message.includes('number')) {
        return { status: 'NUMERO_NAO_VINCULADO', details: subData };
      }
      return { status: 'ERRO', details: subData };
    }

    const phoneUrl = `https://graph.facebook.com/${v}/${encodeURIComponent(phoneNumberId)}?fields=display_phone_number,verified_name,id&access_token=${encodeURIComponent(accessToken)}`;
    const phoneResponse = await fetch(phoneUrl);
    const phoneData = await phoneResponse.json().catch(() => ({}));

    if (!phoneResponse.ok || !phoneData?.id) {
      return {
        status: 'NUMERO_NAO_VINCULADO',
        details: {
          subscribe: subData,
          phone: phoneData
        }
      };
    }

    return {
      status: 'CONECTADO',
      details: {
        me: tokenData,
        subscribe: subData,
        phone: phoneData
      }
    };
  } catch (error: any) {
    return {
      status: 'ERRO',
      details: { message: error?.message || 'Erro inesperado ao validar conexão com a Meta.' }
    };
  }
};

export const testWhatsappMetaConnection = async (req: Request, res: Response) => {
  try {
    const {
      accessToken,
      apiVersion,
      wabaId,
      phoneNumberId
    } = req.body || {};

    const result = await validateMetaConnection({
      accessToken: String(accessToken || ''),
      apiVersion: String(apiVersion || 'v18.0'),
      wabaId: String(wabaId || ''),
      phoneNumberId: String(phoneNumberId || '')
    });

    if (result.status !== 'CONECTADO') {
      return res.status(400).json({
        status: result.status,
        error: 'Falha ao validar conexão com a Meta.',
        details: result.details
      });
    }

    return res.json({ status: result.status, details: result.details });
  } catch (error: any) {
    return res.status(500).json({
      status: 'ERRO',
      error: error?.message || 'Erro ao testar conexão WhatsApp Meta.'
    });
  }
};
