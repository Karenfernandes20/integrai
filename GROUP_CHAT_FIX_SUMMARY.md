# Group Chat Handling Fix - Summary

## Objective
Fix group chat handling to ensure messages are correctly associated with their group JID rather than individual participants.

## Key Changes Made

### 1. Database Schema Update (`server/index.ts` migration)
- **Changed UNIQUE constraint** on `whatsapp_conversations` table
- **Old**: `UNIQUE(external_id, company_id)`
- **New**: `UNIQUE(external_id, instance, company_id)`
- **Reason**: Allows same group (same JID) to exist across multiple instances for the same company

### 2. Webhook Controller (`server/controllers/webhookController.ts`)

#### A. Group JID Identification (Lines 262-297)
- **Strict group detection**: Check if `remoteJid` ends with `@g.us`
- **For groups**: Preserve the full Group JID (e.g., `120363123456789@g.us`)
- **For individuals**: Normalize to `phone@s.whatsapp.net` format
- **Critical**: Never use participant JID as the conversation identifier for groups

#### B. Sender JID Logic (Lines 419-428)
- Extract `sender_jid` from `msg.key.participant` for group messages
- For individual chats, `sender_jid` = `normalizedJid`
- Store both `sender_jid` and `sender_name` in messages table for proper attribution

#### C. Conversation Lookup (Lines 459-481)
```typescript
// Updated query to include instance
WHERE company_id = $2 AND instance = $3 AND (external_id = $1 ...)
```
- **Parameters**: `[normalizedJid, companyId, instance]`
- **Rationale**: Match the UNIQUE constraint exactly
- **Legacy support**: Fallback to phone lookup for individual chats if external_id not found

#### D. Conversation Creation (Lines 543-561)
- **Race condition check** updated to include instance:
  ```sql
  WHERE external_id = $1 AND instance = $2 AND company_id = $3
  ```
- Insert includes `is_group` flag and `group_name`

### 3. Phone Utilities (Already correct)
`server/utils/phoneUtils.ts` contains:
- `isGroupJid(jid)`: Returns true if jid ends with `@g.us`
- `extractPhoneFromJid(jid)`: Extracts numeric part
- `normalizePhone(phone)`: Adds '55' prefix for Brazilian numbers

## Testing & Validation

### Created Test Scripts
1. **`server/analyze_groups.ts`**: Analyze current group chat state
2. **`server/cleanup_groups.ts`**: Script to fix broken group chats (WIP)
3. **`server/fix_constraint.ts`**: Apply database constraint fix
4. **`server/test_query.ts`**: Test basic queries

### Validation Checklist
- [x] Database constraint updated
- [x] Webhook logic correctly identifies groups
- [x] Conversation lookup includes instance
- [x] Race condition check includes instance
- [x] Messages store sender info for groups
- [ ] **TODO**: Test with live Evolution API group messages
- [ ] **TODO**: Verify group metadata fetching works
- [ ] **TODO**: Clean up any existing broken group chats in production DB

## Expected Behavior After Fix

### For Group Messages
1. **Incoming group message** arrives at webhook
2. Extract `remoteJid` from `msg.key.remoteJid` → should be `<groupId>@g.us`
3. Extract `participant` from `msg.key.participant` → individual sender
4. **Conversation**: Created/found using `remoteJid` (the group JID)
5. **Message**: Saved with `sender_jid` = participant JID, linked to group conversation
6. **UI**: Shows all messages under single group chat, with sender names

### For Individual Messages
1. **Incoming message** arrives
2. Extract `remoteJid` → should be phone number based
3. Normalize to `phone@s.whatsapp.net`
4. **Conversation**: Created/found using normalized JID
5. **Message**: Saved with `sender_jid` = same as conversation JID

## Critical Rules
1. **NEVER** use participant JID as `external_id` for groups
2. **ALWAYS** check if JID ends with `@g.us` to identify groups
3. **ALWAYS** store `remoteJid` (group ID) as `external_id` for groups
4. **ALWAYS** store participant info in `sender_jid` and `sender_name` fields

## Next Steps
1. Monitor webhook logs for group messages in production
2. Verify groups appear as single chats in UI
3. Run cleanup script if needed to fix existing data
4. Test group metadata fetching (name, profile pic)
5. Ensure "Groups" tab filters correctly in UI

## Files Modified
- `server/index.ts` (migration logic)
- `server/controllers/webhookController.ts` (main fix)
- Created helper scripts in `server/` directory

---
**Status**: Core logic implemented ✅  
**Last Updated**: 2026-02-11
