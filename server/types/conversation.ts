export type ConversationChannel = 'whatsapp' | 'instagram';

export interface ConversationEntity {
  id: number;
  company_id: number;
  channel: ConversationChannel;
  is_group: boolean;
  group_subject: string | null;
  remote_jid: string;
  instance_key: string | null;
  profile_picture: string | null;
  status: string;
}

