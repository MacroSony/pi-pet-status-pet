'use strict';

const TEAM_ROLES = new Set(['leader', 'member', 'observer']);
const MEMBER_STATES = new Set([
  'idle', 'thinking', 'reading', 'editing', 'searching', 'running',
  'delegating', 'waiting', 'error', 'closed', 'offline',
]);

function setText(doc, id, value) {
  const element = doc.getElementById(id);
  if (element) element.textContent = typeof value === 'string' ? value : String(value ?? '');
}

function renderTeamBoard(team, doc = document) {
  const shell = doc.querySelector('.board-shell');
  const unavailable = doc.getElementById('team-unavailable');
  const valid = team && typeof team === 'object'
    && typeof team.name === 'string'
    && TEAM_ROLES.has(team.role)
    && Array.isArray(team.members);

  if (!valid) {
    if (shell) shell.dataset.teamActive = 'false';
    if (unavailable) unavailable.hidden = false;
    setText(doc, 'team-name', 'Team unavailable');
    setText(doc, 'caller-role', '');
    setText(doc, 'member-count', '');
    const list = doc.getElementById('member-list');
    if (list) list.replaceChildren();
    const pre = doc.getElementById('board-markdown');
    if (pre) pre.textContent = '';
    return false;
  }

  if (shell) shell.dataset.teamActive = 'true';
  if (unavailable) unavailable.hidden = true;
  setText(doc, 'team-name', team.name);
  setText(doc, 'caller-role', team.role);
  setText(doc, 'member-count', `${team.members.length} member${team.members.length === 1 ? '' : 's'}`);

  const list = doc.getElementById('member-list');
  if (list) {
    const rows = [];
    for (const member of team.members.slice(0, 8)) {
      if (!member || typeof member.displayName !== 'string' || !TEAM_ROLES.has(member.role)) continue;
      const row = doc.createElement('div');
      row.className = 'member-row';

      const identity = doc.createElement('div');
      identity.className = 'member-identity';
      const name = doc.createElement('span');
      name.className = 'member-name';
      name.textContent = member.displayName;
      const meta = doc.createElement('span');
      meta.className = 'member-meta';
      meta.textContent = `${member.role} · ${typeof member.host === 'string' ? member.host : 'unknown'}`;
      identity.append(name, meta);

      const state = doc.createElement('span');
      state.className = 'member-state';
      const stateName = MEMBER_STATES.has(member.state) ? member.state : 'offline';
      state.dataset.state = stateName;
      state.textContent = stateName;
      row.append(identity, state);
      rows.push(row);
    }
    list.replaceChildren(...rows);
  }

  const board = team.board && typeof team.board === 'object' ? team.board : null;
  const boardReady = board && board.status === 'ready' && Number.isSafeInteger(board.revision) && board.revision >= 0;
  const pre = doc.getElementById('board-markdown');
  const boardUnavailable = doc.getElementById('board-unavailable');
  if (boardUnavailable) boardUnavailable.hidden = !!boardReady;
  if (pre) {
    pre.hidden = !boardReady;
    // Deliberately plain text. Teammate-authored Markdown is untrusted data and
    // must never be assigned through innerHTML.
    pre.textContent = boardReady
      ? ((typeof board.markdown === 'string' && board.markdown.length > 0) ? board.markdown : 'No notes yet.')
      : '';
  }
  setText(doc, 'board-revision', boardReady ? `rev ${board.revision}` : 'unavailable');
  setText(doc, 'board-attribution', boardReady && typeof board.updatedBy === 'string' && board.updatedBy
    ? `Last updated by ${board.updatedBy}`
    : '');
  return true;
}

async function initializeTeamBoard(win = window, doc = document) {
  const tauri = win.__TAURI__;
  if (!tauri || !tauri.core || !tauri.event) return false;
  const initial = await tauri.core.invoke('get_team_presentation').catch(() => null);
  renderTeamBoard(initial, doc);
  await tauri.event.listen('team-presentation-update', (event) => {
    renderTeamBoard(event ? event.payload : null, doc);
  });
  return true;
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => { initializeTeamBoard(); });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { initializeTeamBoard, renderTeamBoard, MEMBER_STATES, TEAM_ROLES };
}
