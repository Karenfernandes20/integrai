import React from 'react';

export type GroupCardChannel = 'whatsapp' | 'instagram';

export interface GroupCardConversation {
  id: number;
  group_subject?: string | null;
  channel: GroupCardChannel;
  profile_picture?: string | null;
}

const badgeStyles: Record<GroupCardChannel, string> = {
  whatsapp: 'bg-green-100 text-green-700 border-green-300',
  instagram: 'bg-pink-100 text-pink-700 border-pink-300'
};

export const GroupCardExample = ({ conversation }: { conversation: GroupCardConversation }) => {
  const name = conversation.group_subject?.trim() || 'Grupo WhatsApp';
  const channelLabel = conversation.channel === 'instagram' ? 'INSTAGRAM' : 'WHATSAPP';

  return (
    <article className="flex items-center gap-3 rounded-xl border p-3">
      <img
        src={conversation.profile_picture || '/group-placeholder.png'}
        alt={name}
        className="h-12 w-12 rounded-full object-cover"
      />

      <div className="flex min-w-0 flex-col gap-1">
        <strong className="truncate text-sm text-slate-900">{name}</strong>
        <span
          className={`inline-flex w-fit rounded-full border px-2 py-0.5 text-[11px] font-semibold ${badgeStyles[conversation.channel]}`}
        >
          {channelLabel}
        </span>
      </div>
    </article>
  );
};

