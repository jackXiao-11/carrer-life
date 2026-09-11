const STORAGE_KEY = "career-life-v1";
const LEGACY_STORAGE_KEY = "buji-work-learn-v1";
const CHAT_STORAGE_KEY = "career-life-chat-v1";

const categoryLabels = {
  work: "工作",
  software: "软件",
  english: "英语",
};

const viewTitles = {
  dashboard: "专注今天，从容前行。",
  plans: "让每一天，都有所积累。",
  records: "记录工作，也记录成长。",
  workspace: "修行之路，始于足下。",
  plaza: "万千修行者，同登此峰。",
};

const modelNotes = {
  deepseek: "可添加任务、完成任务与记录成果",
  codex: "可添加任务、完成任务与记录成果",
};

const today = getLocalDate();
let activeFilter = "all";
let selectedWeekDay = today;
let ringAnimation;
let toastTimer;
let state = loadState();
let chatState = loadChatState();
let activeModel = chatState.model;
let chatMessages = chatState.conversations[activeModel];
let chatController = null;
let chatReturnFocus = null;
let accountUser = null;
let accountSyncTimer = null;
let accountSyncInFlight = false;
let accountSyncQueued = false;
let accountMode = "login";
let profileCache = null;
let friendsCache = { friends: [], incoming: [], outgoing: [] };
let currentView = "dashboard";

const CULTIVATION_LEVELS = [
  { level: 1, name: "凡人", xp: 0 },
  { level: 2, name: "炼气期", xp: 100 },
  { level: 3, name: "筑基期", xp: 250 },
  { level: 4, name: "金丹期", xp: 450 },
  { level: 5, name: "元婴期", xp: 700 },
  { level: 6, name: "化神期", xp: 1000 },
  { level: 7, name: "炼虚期", xp: 1400 },
  { level: 8, name: "合体期", xp: 1900 },
  { level: 9, name: "大乘期", xp: 2500 },
  { level: 10, name: "渡劫·飞升", xp: 3300 },
];

function getCultivationLevel(xp) {
  const safeXp = Math.max(0, Number(xp) || 0);
  let current = CULTIVATION_LEVELS[0];
  for (const entry of CULTIVATION_LEVELS) if (safeXp >= entry.xp) current = entry;
  const next = CULTIVATION_LEVELS[current.level] || null;
  const span = next ? next.xp - current.xp : 1;
  const gained = next ? safeXp - current.xp : 1;
  return {
    level: current.level,
    name: current.name,
    nextName: next ? next.name : null,
    nextXp: next ? next.xp : null,
    remainingXp: next ? Math.max(0, next.xp - safeXp) : 0,
    progress: next ? Math.min(1, gained / span) : 1,
  };
}

const elements = {
  todayLabel: document.querySelector("#today-label"),
  viewTitle: document.querySelector("#view-title"),
  addTaskButton: document.querySelector("#add-task-button"),
  taskDialog: document.querySelector("#task-dialog"),
  taskForm: document.querySelector("#task-form"),
  dialogTitle: document.querySelector("#dialog-title"),
  todayTaskList: document.querySelector("#today-task-list"),
  softwarePlanList: document.querySelector("#software-plan-list"),
  englishPlanList: document.querySelector("#english-plan-list"),
  recordForm: document.querySelector("#record-form"),
  recordList: document.querySelector("#record-list"),
  toast: document.querySelector("#toast"),
  chatMessages: document.querySelector("#chat-messages"),
  chatForm: document.querySelector("#chat-form"),
  chatInput: document.querySelector("#chat-input"),
  chatStatus: document.querySelector("#chat-status"),
  sendChatButton: document.querySelector("#send-chat-button"),
  stopChatButton: document.querySelector("#stop-chat-button"),
  modelNote: document.querySelector("#model-note"),
  chatWindow: document.querySelector("#ai-window"),
  chatLauncher: document.querySelector("#chat-launcher"),
  chatModel: document.querySelector("#chat-model"),
  accountButton: document.querySelector("#account-button"),
  accountLabel: document.querySelector("#account-label"),
  accountSyncStatus: document.querySelector("#account-sync-status"),
  accountDialog: document.querySelector("#account-dialog"),
  accountForm: document.querySelector("#account-form"),
  accountEmail: document.querySelector("#account-email"),
  accountPassword: document.querySelector("#account-password"),
  accountError: document.querySelector("#account-error"),
  accountSubmit: document.querySelector("#account-submit"),
  accountSwitch: document.querySelector("#account-switch"),
  accountDialogTitle: document.querySelector("#account-dialog-title"),
  accountDialogSubtitle: document.querySelector("#account-dialog-subtitle"),
  accountLoggedIn: document.querySelector("#account-logged-in"),
  accountUserEmail: document.querySelector("#account-user-email"),
  accountLoggedInStatus: document.querySelector("#account-logged-in-status"),
  workspaceLogin: document.querySelector("#workspace-login"),
  workspaceLoginButton: document.querySelector("#workspace-login-button"),
  workspaceGrid: document.querySelector("#workspace-grid"),
  sidebarXp: document.querySelector("#sidebar-xp"),
  sidebarLevelLabel: document.querySelector("#sidebar-level-label"),
  sidebarLevelPill: document.querySelector("#sidebar-level-pill"),
  sidebarXpText: document.querySelector("#sidebar-xp-text"),
  sidebarXpFill: document.querySelector("#sidebar-xp-fill"),
  wsLevelPill: document.querySelector("#ws-level-pill"),
  wsXpFill: document.querySelector("#ws-xp-fill"),
  wsXpText: document.querySelector("#ws-xp-text"),
  wsTaskXpNote: document.querySelector("#ws-task-xp-note"),
  checkinButton: document.querySelector("#checkin-button"),
  checkinStreak: document.querySelector("#checkin-streak"),
  nameForm: document.querySelector("#name-form"),
  displayNameInput: document.querySelector("#display-name-input"),
  friendForm: document.querySelector("#friend-form"),
  friendEmail: document.querySelector("#friend-email"),
  incomingBlock: document.querySelector("#incoming-block"),
  incomingList: document.querySelector("#incoming-list"),
  friendsList: document.querySelector("#friends-list"),
  collabForm: document.querySelector("#collab-form"),
  collabTitleInput: document.querySelector("#collab-title-input"),
  collabFriendSelect: document.querySelector("#collab-friend-select"),
  collabCategory: document.querySelector("#collab-category"),
  collabList: document.querySelector("#collab-list"),
  leaderboardList: document.querySelector("#leaderboard-list"),
  leaderboardRefresh: document.querySelector("#leaderboard-refresh"),
  myRankCard: document.querySelector("#my-rank-card"),
  brandAvatar: document.querySelector("#brand-avatar"),
  brandIcon: document.querySelector("#brand-icon"),
  sidebarAvatar: document.querySelector("#sidebar-avatar"),
  avatarPreview: document.querySelector("#avatar-preview"),
  avatarInput: document.querySelector("#avatar-input"),
  avatarRemove: document.querySelector("#avatar-remove"),
  statsGrid: document.querySelector("#stats-grid"),
  statsDonut: document.querySelector("#stats-donut"),
  donutCenter: document.querySelector("#donut-center"),
  donutLegend: document.querySelector("#donut-legend"),
  statsBars: document.querySelector("#stats-bars"),
  statsBarLabels: document.querySelector("#stats-bar-labels"),
  statsEmpty: document.querySelector("#stats-empty"),
  verifyDialog: document.querySelector("#verify-dialog"),
  verifySubmitPanel: document.querySelector("#verify-submit-panel"),
  verifyQuizPanel: document.querySelector("#verify-quiz-panel"),
  verifyResultPanel: document.querySelector("#verify-result-panel"),
  verifyTaskTitle: document.querySelector("#verify-task-title"),
  verifyEnglishBlock: document.querySelector("#verify-english-block"),
  verifyOtherBlock: document.querySelector("#verify-other-block"),
  verifyWordsInput: document.querySelector("#verify-words-input"),
  verifyNotesInput: document.querySelector("#verify-notes-input"),
  verifyError: document.querySelector("#verify-error"),
  quizError: document.querySelector("#quiz-error"),
  quizStatus: document.querySelector("#verify-quiz-status"),
  quizBody: document.querySelector("#verify-quiz-body"),
  quizAnswerButton: document.querySelector("#quiz-answer-button"),
  verifyResultTitle: document.querySelector("#verify-result-title"),
  verifyResultText: document.querySelector("#verify-result-text"),
  wordList: document.querySelector("#word-list"),
  wordCount: document.querySelector("#word-count"),
  filesRefresh: document.querySelector("#files-refresh"),
  fileInput: document.querySelector("#file-input"),
  uploadButton: document.querySelector("#upload-button"),
  uploadProgress: document.querySelector("#upload-progress"),
  uploadName: document.querySelector("#upload-name"),
  uploadProgressFill: document.querySelector("#upload-progress-fill"),
  storageUsed: document.querySelector("#storage-used"),
  storageFilesCount: document.querySelector("#storage-files-count"),
  storageFill: document.querySelector("#storage-fill"),
  storageLevelNote: document.querySelector("#storage-level-note"),
  fileList: document.querySelector("#file-list"),
};

initialize();

function initialize() {
  elements.todayLabel.textContent = new Intl.DateTimeFormat("zh-CN", {
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(new Date());
  document.querySelector("#record-date").value = today;
  document.querySelectorAll(".nav-item").forEach((button) => {
    const label = button.querySelector("span")?.textContent.trim();
    if (label) {
      button.setAttribute("aria-label", label);
      button.title = label;
    }
  });
  bindEvents();
  render();
  renderChatMessages();
  elements.chatModel.value = activeModel;
  elements.modelNote.textContent = modelNotes[activeModel];
  elements.chatInput.value = chatState.drafts[activeModel];
  updateComposer();
  restoreView();
  refreshIcons();
  initializeAccount();
}

function bindEvents() {
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", () => switchView(button.dataset.view));
  });

  document.querySelectorAll("[data-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      activeFilter = button.dataset.filter;
      document.querySelectorAll("[data-filter]").forEach((item) => {
        item.classList.toggle("is-selected", item === button);
        item.setAttribute("aria-pressed", item === button);
      });
      renderTodayTasks();
    });
  });

  elements.addTaskButton.addEventListener("click", () => openTaskDialog());
  document
    .querySelector("#add-task-inline")
    .addEventListener("click", () => openTaskDialog());
  document
    .querySelector("#close-dialog-button")
    .addEventListener("click", closeTaskDialog);
  document
    .querySelector("#cancel-dialog-button")
    .addEventListener("click", closeTaskDialog);
  elements.taskDialog.addEventListener("click", (event) => {
    if (event.target === elements.taskDialog) closeTaskDialog();
  });

  elements.taskForm.addEventListener("submit", saveTask);
  elements.todayTaskList.addEventListener("change", handleTaskToggle);
  elements.todayTaskList.addEventListener("click", handleTaskAction);
  elements.softwarePlanList.addEventListener("change", handleTaskToggle);
  elements.softwarePlanList.addEventListener("click", handleTaskAction);
  elements.englishPlanList.addEventListener("change", handleTaskToggle);
  elements.englishPlanList.addEventListener("click", handleTaskAction);
  document.querySelector("#week-day-list").addEventListener("click", handleTaskAction);
  document.querySelector("#week-chart").addEventListener("click", (event) => {
    const button = event.target.closest("[data-week-day]");
    if (!button) return;
    selectedWeekDay = button.dataset.weekDay;
    document.querySelectorAll("[data-week-day]").forEach((day) => {
      day.setAttribute("aria-pressed", day === button);
    });
    renderWeekDetails();
    const list = document.querySelector("#week-day-list");
    if (list.animate && !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      list.getAnimations().forEach((animation) => animation.cancel());
      list.animate([{ opacity: 0, transform: "translateX(16px)" }, { opacity: 1, transform: "translateX(0)" }], {
        duration: 280, easing: "cubic-bezier(.22,1,.36,1)",
      });
    }
  });
  elements.recordForm.addEventListener("submit", saveRecord);
  elements.recordList.addEventListener("click", deleteRecord);
  elements.accountButton?.addEventListener("click", openAccountDialog);
  elements.accountForm?.addEventListener("submit", submitAccountForm);
  elements.accountSwitch?.addEventListener("click", toggleAccountMode);
  document.querySelector("#close-account-button")?.addEventListener("click", closeAccountDialog);
  document.querySelector("#account-close")?.addEventListener("click", closeAccountDialog);
  document.querySelector("#account-logout")?.addEventListener("click", logoutAccount);
  elements.workspaceLoginButton?.addEventListener("click", openAccountDialog);
  elements.checkinButton?.addEventListener("click", handleCheckin);
  elements.nameForm?.addEventListener("submit", saveDisplayName);
  elements.friendForm?.addEventListener("submit", sendFriendRequest);
  elements.incomingList?.addEventListener("click", handleFriendRespond);
  elements.collabForm?.addEventListener("submit", createCollabTask);
  elements.collabList?.addEventListener("change", handleCollabToggle);
  elements.collabList?.addEventListener("click", handleCollabDelete);
  elements.leaderboardRefresh?.addEventListener("click", loadLeaderboard);
  elements.filesRefresh?.addEventListener("click", loadFiles);
  elements.uploadButton?.addEventListener("click", () => elements.fileInput?.click());
  elements.fileInput?.addEventListener("change", handleFileSelect);
  elements.fileList?.addEventListener("click", handleFileAction);
  elements.avatarInput?.addEventListener("change", handleAvatarSelect);
  elements.avatarRemove?.addEventListener("click", removeAvatar);
  document.querySelector("#close-verify-button")?.addEventListener("click", closeVerifyDialog);
  document.querySelector("#verify-cancel-button")?.addEventListener("click", closeVerifyDialog);
  document.querySelector("#verify-submit-button")?.addEventListener("click", submitVerification);
  document.querySelector("#verify-result-close")?.addEventListener("click", () => elements.verifyDialog?.close());
  elements.quizAnswerButton?.addEventListener("click", answerQuiz);
  elements.quizBody?.addEventListener("change", () => {
    if (elements.quizAnswerButton) elements.quizAnswerButton.disabled = !elements.quizBody.querySelector("input[name='quiz-option']:checked");
  });
  bindLauncherDrag();
  elements.chatModel.addEventListener("change", () =>
    selectModel(elements.chatModel.value),
  );
  document.querySelectorAll("[data-chat-toggle]").forEach((button) => {
    button.addEventListener("click", () =>
      toggleChat(elements.chatWindow.hidden),
    );
  });
  document
    .querySelector("#close-chat-button")
    .addEventListener("click", () => toggleChat(false));
  document
    .querySelector("#expand-chat-button")
    .addEventListener("click", toggleChatSize);
  document.querySelector("#ask-next-task").addEventListener("click", () => {
    const task = state.tasks.find(
      (item) => item.date === today && !item.completed,
    );
    fillChatPrompt(
      task
        ? `请把这个任务拆成可执行的步骤：${task.title}。预计 ${task.minutes} 分钟。`
        : "请帮我安排一个 30 分钟的软件学习计划。",
    );
  });
  window.addEventListener("hashchange", restoreView);
  window.addEventListener("resize", syncChatMode);
  document.addEventListener("keydown", (event) => {
    if (
      event.key === "Escape" &&
      !elements.chatWindow.hidden &&
      !elements.taskDialog.open
    ) {
      event.preventDefault();
      toggleChat(false);
    }
    if (
      event.key === "Tab" &&
      document.documentElement.classList.contains("chat-fullscreen")
    ) {
      const controls = [
        ...elements.chatWindow.querySelectorAll(
          "button:not(:disabled), select:not(:disabled), textarea, a[href]",
        ),
      ].filter((control) => control.getClientRects().length && !control.hidden);
      const first = controls[0];
      const last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
  });
  elements.chatForm.addEventListener("submit", sendChatMessage);
  elements.chatInput.addEventListener("input", () => {
    updateComposer();
    persistChat();
  });
  elements.chatInput.addEventListener("keydown", (event) => {
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.isComposing &&
      event.keyCode !== 229
    ) {
      event.preventDefault();
      elements.chatForm.requestSubmit();
    }
  });
  elements.stopChatButton.addEventListener("click", stopChatRequest);
  document
    .querySelector("#clear-chat-button")
    .addEventListener("click", clearChat);
  elements.chatMessages.addEventListener("click", copyChatMessage);
  elements.chatMessages.addEventListener("click", (event) => {
    const prompt = event.target.closest("[data-prompt]");
    if (prompt) fillChatPrompt(prompt.dataset.prompt);
    if (event.target.closest("[data-retry]")) sendChatMessage(null, true);
  });
}

function switchView(viewName) {
  if (!viewTitles[viewName]) viewName = "dashboard";
  document.querySelectorAll(".nav-item").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.view === viewName);
    if (button.dataset.view === viewName)
      button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
  document.querySelectorAll(".view").forEach((view) => {
    const isCurrent = view.id === `${viewName}-view`;
    view.classList.toggle("is-active", isCurrent);
    view.hidden = !isCurrent;
  });
  elements.viewTitle.textContent = viewTitles[viewName];
  document.querySelector("#breadcrumb-title").textContent = {
    dashboard: "今日概览",
    plans: "学习计划",
    records: "工作记录",
    workspace: "个人工作空间",
    plaza: "广场",
  }[viewName];
  document.querySelector("#view-subtitle").textContent = {
    dashboard: "把时间留给重要的事。",
    plans: "软件能力与英语，一起向前。",
    records: "每一个解决的问题，都值得留下。",
    workspace: "签到、修行、结伴同行。",
    plaza: "看看谁在榜上风云。",
  }[viewName];
  elements.addTaskButton.hidden = viewName === "records" || viewName === "workspace" || viewName === "plaza";
  if (viewName === "workspace") loadWorkspace();
  if (viewName === "plaza") loadLeaderboard();
  const targetHash = `#${viewName}`;
  if (window.location.hash !== targetHash) {
    if (viewName !== "dashboard" && currentView === "dashboard") {
      // Home -> secondary page: keep one history entry so swiping back always returns home.
      window.history.pushState({ view: viewName }, "", targetHash);
    } else {
      // Secondary -> secondary, or back to home: replace in place to avoid a messy stack.
      window.history.replaceState({ view: viewName }, "", targetHash);
    }
  }
  currentView = viewName;
}

async function initializeAccount() {
  if (!elements.accountButton) return;
  setAccountStatus("本地存储");
  try {
    const response = await fetch("/api/auth/me", { credentials: "same-origin", headers: { Accept: "application/json" } });
    if (!response.ok) return;
    const data = await response.json();
    if (data.user) {
      accountUser = data.user;
      updateAccountUi();
      await syncFromCloud();
      await loadProfile();
    }
  } catch {
    // Offline and unconfigured deployments continue with local-only storage.
  }
}

function openAccountDialog() {
  if (!elements.accountDialog) return;
  updateAccountUi();
  if (!accountUser) setAccountMode("login");
  elements.accountDialog.showModal();
  if (!accountUser) elements.accountEmail?.focus();
}

function closeAccountDialog() {
  if (elements.accountDialog?.open) elements.accountDialog.close();
}

function toggleAccountMode() {
  setAccountMode(accountMode === "login" ? "register" : "login");
}

function setAccountMode(mode) {
  accountMode = mode === "register" ? "register" : "login";
  if (elements.accountDialogTitle) elements.accountDialogTitle.textContent = accountMode === "register" ? "创建 Career Life 账号" : "登录 Career Life";
  if (elements.accountDialogSubtitle) elements.accountDialogSubtitle.textContent = accountMode === "register" ? "注册后可在不同设备继续使用你的数据" : "登录后可在不同设备继续使用你的数据";
  if (elements.accountSubmit) elements.accountSubmit.textContent = accountMode === "register" ? "注册并同步" : "登录并同步";
  if (elements.accountSwitch) elements.accountSwitch.textContent = accountMode === "register" ? "已有账号？登录" : "创建账号";
  if (elements.accountPassword) elements.accountPassword.autocomplete = accountMode === "register" ? "new-password" : "current-password";
  if (elements.accountError) elements.accountError.textContent = "";
}

function updateAccountUi() {
  if (!elements.accountButton) return;
  const loggedIn = !!accountUser;
  elements.accountLabel.textContent = loggedIn ? (accountUser.email || "已登录") : "登录 / 注册";
  elements.accountSyncStatus.textContent = loggedIn ? "云端同步" : "本地存储";
  if (elements.accountForm) elements.accountForm.hidden = loggedIn;
  if (elements.accountLoggedIn) elements.accountLoggedIn.hidden = !loggedIn;
  if (elements.accountUserEmail && loggedIn) elements.accountUserEmail.textContent = accountUser.email || "已登录";
  if (elements.accountDialogTitle) {
    elements.accountDialogTitle.textContent = loggedIn ? "我的账户" : (accountMode === "register" ? "创建 Career Life 账号" : "登录 Career Life");
  }
  if (elements.accountDialogSubtitle) {
    elements.accountDialogSubtitle.textContent = loggedIn ? "账号已连接，数据自动云端同步" : (accountMode === "register" ? "注册后可在不同设备继续使用你的数据" : "登录后可在不同设备继续使用你的数据");
  }
}

function setAccountStatus(message) {
  if (elements.accountSyncStatus) elements.accountSyncStatus.textContent = message;
  if (elements.accountLoggedInStatus) elements.accountLoggedInStatus.textContent = message;
}

async function submitAccountForm(event) {
  event.preventDefault();
  const email = elements.accountEmail?.value.trim();
  const password = elements.accountPassword?.value || "";
  if (!email || !password) return;
  elements.accountSubmit.disabled = true;
  if (elements.accountError) elements.accountError.textContent = "正在连接账户服务…";
  try {
    const response = await fetch(`/api/auth/${accountMode}`, {
      method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.user) throw new Error(data.error || "账户服务暂时不可用，请稍后再试。");
    accountUser = data.user;
    updateAccountUi();
    setAccountStatus("正在同步数据…");
    await syncFromCloud();
    await loadProfile();
    closeAccountDialog();
    showToast("账户已连接，数据已同步");
  } catch (error) {
    if (elements.accountError) elements.accountError.textContent = error.message || "连接失败，请稍后再试。";
  } finally {
    elements.accountSubmit.disabled = false;
  }
}

async function logoutAccount() {
  try { await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" }); } catch { /* local mode remains available */ }
  accountUser = null;
  window.clearTimeout(accountSyncTimer);
  resetProfileUi();
  updateAccountUi();
  closeAccountDialog();
  showToast("已退出，当前继续使用本地数据");
}

function scheduleCloudSync() {
  if (!accountUser) return;
  window.clearTimeout(accountSyncTimer);
  accountSyncTimer = window.setTimeout(() => syncToCloud(), 900);
  setAccountStatus("等待同步…");
}

async function syncToCloud() {
  if (!accountUser) return;
  if (accountSyncInFlight) { accountSyncQueued = true; return; }
  accountSyncInFlight = true;
  setAccountStatus("正在同步…");
  try {
    const response = await fetch("/api/data", {
      method: "PUT", credentials: "same-origin", headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ data: state }),
    });
    if (response.status === 401) { accountUser = null; updateAccountUi(); setAccountStatus("本地存储"); return; }
    if (!response.ok) throw new Error("sync failed");
    setAccountStatus("已同步");
  } catch { setAccountStatus("同步失败，将稍后重试"); }
  finally {
    accountSyncInFlight = false;
    if (accountSyncQueued) { accountSyncQueued = false; scheduleCloudSync(); }
  }
}

async function syncFromCloud() {
  if (!accountUser) return;
  try {
    const response = await fetch("/api/data", { credentials: "same-origin", headers: { Accept: "application/json" } });
    if (response.status === 401) { accountUser = null; updateAccountUi(); return; }
    if (!response.ok) throw new Error("load failed");
    const remote = await response.json();
    if (remote.data && typeof remote.data === "object") {
      const merged = mergeAccountState(state, remote.data);
      const changed = JSON.stringify(merged) !== JSON.stringify(state);
      state = merged;
      persist(false);
      render();
      if (changed || !remote.data.tasks?.length && !remote.data.records?.length) await syncToCloud();
    }
    setAccountStatus("已同步");
  } catch { setAccountStatus("云端暂不可用，仍使用本地数据"); }
}

function mergeAccountState(local, remote) {
  const mergeList = (localList, remoteList) => {
    const result = Array.isArray(localList) ? localList.map((item) => ({ ...item })) : [];
    const ids = new Set(result.map((item) => item.id));
    for (const item of Array.isArray(remoteList) ? remoteList : []) {
      if (!item || typeof item !== "object") continue;
      if (!ids.has(item.id)) { result.push({ ...item }); ids.add(item.id); }
    }
    return result;
  };
  const mergeWords = (localList, remoteList) => {
    const result = Array.isArray(localList) ? localList.map((item) => ({ ...item })) : [];
    const seen = new Set(result.map((item) => `${item.word}::${item.taskId || ""}`));
    for (const item of Array.isArray(remoteList) ? remoteList : []) {
      if (!item || typeof item !== "object" || !item.word) continue;
      const key = `${item.word}::${item.taskId || ""}`;
      if (!seen.has(key)) { result.push({ ...item }); seen.add(key); }
    }
    return result;
  };
  return {
    tasks: mergeList(local?.tasks, remote?.tasks),
    records: mergeList(local?.records, remote?.records),
    words: mergeWords(local?.words, remote?.words),
  };
}

function applyProfileUi() {
  const loggedIn = !!accountUser;
  if (elements.sidebarXp) elements.sidebarXp.hidden = !loggedIn;
  if (elements.workspaceLogin) elements.workspaceLogin.hidden = loggedIn;
  if (elements.workspaceGrid) elements.workspaceGrid.hidden = !loggedIn;
  const avatar = profileCache?.avatar || null;
  if (elements.brandAvatar && elements.brandIcon) {
    elements.brandAvatar.hidden = !avatar;
    elements.brandAvatar.closest(".brand-mark")?.classList.toggle("has-avatar", !!avatar);
    if (avatar) elements.brandAvatar.src = avatar;
  }
  if (elements.sidebarAvatar) {
    elements.sidebarAvatar.hidden = !avatar;
    if (avatar) elements.sidebarAvatar.src = avatar;
  }
  if (elements.avatarPreview) {
    elements.avatarPreview.innerHTML = avatar
      ? `<img src="${avatar}" alt="头像预览" />`
      : `<i data-lucide="user-round"></i>`;
    refreshIcons();
  }
  if (elements.avatarRemove) elements.avatarRemove.hidden = !avatar;
  if (!loggedIn) return;
  const info = profileCache ? profileCache.level : getCultivationLevel(0);
  const xp = profileCache?.xp || 0;
  if (elements.sidebarLevelLabel) elements.sidebarLevelLabel.textContent = accountUser ? `Lv.${info.level} ${info.name}` : "点击进入修行";
  if (elements.sidebarLevelPill) elements.sidebarLevelPill.textContent = info.name;
  if (elements.sidebarXpText) elements.sidebarXpText.textContent = `${xp} XP`;
  if (elements.sidebarXpFill) elements.sidebarXpFill.style.width = `${Math.round(info.progress * 100)}%`;
  if (elements.wsLevelPill) elements.wsLevelPill.textContent = `Lv.${info.level} ${info.name}`;
  if (elements.wsXpFill) elements.wsXpFill.style.width = `${Math.round(info.progress * 100)}%`;
  if (elements.wsXpText) {
    elements.wsXpText.textContent = info.nextName
      ? `${xp} XP · 距离【${info.nextName}】还差 ${info.remainingXp} XP`
      : `${xp} XP · 已至大道巅峰`;
  }
  if (elements.checkinButton) {
    const checked = !!profileCache?.checkin?.checkedInToday;
    elements.checkinButton.disabled = checked;
    elements.checkinButton.querySelector("span").textContent = checked ? "今日已签到" : "每日签到 +10";
  }
  if (elements.checkinStreak) elements.checkinStreak.textContent = `连续签到 ${profileCache?.checkin?.streak || 0} 天`;
  if (elements.wsTaskXpNote) {
    const used = profileCache?.taskXp?.usedToday || 0;
    const limit = profileCache?.taskXp?.limit || 5;
    elements.wsTaskXpNote.textContent = `今日任务经验 ${used}/${limit} · 每完成一个任务 +10 XP`;
  }
  if (elements.displayNameInput && document.activeElement !== elements.displayNameInput) {
    elements.displayNameInput.value = profileCache?.displayName || "";
  }
}

function resetProfileUi() {
  profileCache = null;
  friendsCache = { friends: [], incoming: [], outgoing: [] };
  if (elements.sidebarLevelLabel) elements.sidebarLevelLabel.textContent = "点击进入修行";
  if (elements.friendsList) elements.friendsList.innerHTML = "";
  if (elements.collabList) elements.collabList.innerHTML = "";
  applyProfileUi();
}

async function loadProfile() {
  if (!accountUser) return;
  try {
    const response = await fetch("/api/profile", { credentials: "same-origin", headers: { Accept: "application/json" } });
    if (response.status === 401) { accountUser = null; updateAccountUi(); resetProfileUi(); return; }
    if (!response.ok) throw new Error("profile failed");
    const data = await response.json();
    profileCache = data.profile;
    applyProfileUi();
  } catch {
    if (elements.sidebarLevelLabel) elements.sidebarLevelLabel.textContent = "修为暂不可用";
  }
}

async function loadWorkspace() {
  applyProfileUi();
  if (!accountUser) return;
  renderWorkspaceStats();
  await Promise.all([loadProfile(), loadFriends(), loadCollabTasks(), loadFiles()]);
  renderWorkspaceStats();
}

async function requestTaskXp(type = "task") {
  if (!accountUser) return;
  try {
    const response = await fetch("/api/profile/task-xp", {
      method: "POST", credentials: "same-origin",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ type }),
    });
    if (!response.ok) return;
    const data = await response.json();
    if (data.awarded && data.profile) {
      profileCache = data.profile;
      applyProfileUi();
      if (data.leveledUp) showToast(`恭喜突破！晋升【${data.profile.level.name}】`);
    }
  } catch { /* XP sync silently retries on next action */ }
}

let verifyTaskId = null;
let quizData = null;

function closeVerifyDialog() {
  if (elements.verifyDialog?.open) elements.verifyDialog.close();
}

function openVerifyDialog(taskId) {
  const task = state.tasks.find((item) => item.id === taskId);
  if (!task || !task.completed || task.verified) return;
  verifyTaskId = taskId;
  quizData = null;
  elements.verifyTaskTitle.textContent = task.title;
  const isEnglish = task.category === "english";
  elements.verifyEnglishBlock.hidden = !isEnglish;
  elements.verifyOtherBlock.hidden = isEnglish;
  elements.verifySubmitPanel.hidden = false;
  elements.verifyQuizPanel.hidden = true;
  elements.verifyResultPanel.hidden = true;
  elements.verifyError.textContent = "";
  elements.quizError.textContent = "";
  elements.verifyWordsInput.value = (task.submissionWords || []).join("\n");
  elements.verifyNotesInput.value = task.submission || "";
  if (!elements.verifyDialog.open) elements.verifyDialog.showModal();
  (isEnglish ? elements.verifyWordsInput : elements.verifyNotesInput).focus();
}

function submitVerification() {
  const task = state.tasks.find((item) => item.id === verifyTaskId);
  if (!task) return;
  if (task.category === "english") submitEnglishVerification(task);
  else submitOtherVerification(task);
}

function submitOtherVerification(task) {
  const text = elements.verifyNotesInput.value.trim();
  if (text.length < 5) {
    elements.verifyError.textContent = "请填写至少 5 个字的验收说明。";
    return;
  }
  task.submission = text;
  task.verified = true;
  persist();
  render();
  finishVerification("验收通过！", accountUser ? "经验 +10 已到账，继续保持。" : "登录后可以获得经验奖励。");
}

async function submitEnglishVerification(task) {
  const words = [...new Set(
    elements.verifyWordsInput.value
      .split(/[\n,，;；、\s]+/)
      .map((word) => word.trim().toLowerCase())
      .filter(Boolean),
  )];
  if (words.length < 3) {
    elements.verifyError.textContent = "至少填入 3 个单词，例如背 10 个就填 10 个。";
    return;
  }
  if (words.length > 60) {
    elements.verifyError.textContent = "一次最多提交 60 个单词。";
    return;
  }
  elements.verifyError.textContent = "";
  const button = document.querySelector("#verify-submit-button");
  const buttonLabel = button.querySelector("span");
  button.disabled = true;
  buttonLabel.textContent = "AI 正在出题…";
  try {
    state.words = (state.words || []).filter((word) => word.taskId !== task.id);
    words.forEach((word) => {
      state.words.unshift({ id: createId(), word, meaning: "", date: today, taskId: task.id });
    });
    task.submissionWords = words;
    persist();
    renderWords();

    const quiz = await fetchWordQuiz(words);
    const meaningMap = new Map((quiz.meanings || []).map((item) => [String(item.word).toLowerCase(), item.meaning]));
    state.words.forEach((entry) => {
      if (entry.taskId === task.id && !entry.meaning && meaningMap.has(entry.word)) entry.meaning = meaningMap.get(entry.word);
    });
    persist();
    renderWords();

    quizData = { questions: quiz.quiz, index: 0, answers: [] };
    elements.verifySubmitPanel.hidden = true;
    elements.verifyQuizPanel.hidden = false;
    renderQuizQuestion();
  } catch (error) {
    elements.verifyError.textContent = error.message || "AI 暂时不可用。单词已存入单词本，稍后重新点「验收」即可。";
  } finally {
    button.disabled = false;
    buttonLabel.textContent = "提交并验收";
  }
}

async function fetchWordQuiz(words) {
  const prompt = `你是英语老师。用户刚背了这些单词：${words.join("、")}。请只返回严格 JSON，不要 markdown、不要解释，格式：{"meanings":[{"word":"单词","meaning":"中文释义"}]（列表里每个单词都要有），"quiz":[{"word":"随机抽的单词","answer":"该单词正确中文释义","options":["4个中文选项，包含answer并打乱"]}]}。quiz 固定抽 3 个不同单词。`;
  const response = await fetch("/api/chat", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "deepseek", messages: [{ role: "user", content: prompt }] }),
  });
  if (!response.ok) throw new Error("AI 服务暂时不可用，请稍后重试。");
  if (!response.body) throw new Error("AI 没有返回内容，请重试。");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    text += decoder.decode(value, { stream: true });
  }
  const cleaned = text.replace(/<\/?think>/gi, "").replace(/```json|```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("AI 出题格式异常，请重试。");
  let parsed;
  try {
    parsed = JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    throw new Error("AI 出题格式异常，请重试。");
  }
  const questions = (parsed.quiz || []).filter((item) => item.word && item.answer).slice(0, 3);
  if (!questions.length) throw new Error("AI 没有出题成功，请重试。");
  questions.forEach((item) => {
    if (!Array.isArray(item.options) || !item.options.includes(item.answer)) {
      item.options = [item.answer, "名词短语", "动词原形", "形容词"];
    }
    item.options = [...new Set(item.options)].slice(0, 4);
  });
  return { meanings: parsed.meanings || [], quiz: questions };
}

function renderQuizQuestion() {
  const question = quizData.questions[quizData.index];
  elements.quizStatus.textContent = `第 ${quizData.index + 1} / ${quizData.questions.length} 题：选出这个单词的中文释义`;
  elements.quizBody.innerHTML = `
    <div class="quiz-question">
      <p class="quiz-word">${escapeHtml(question.word)}</p>
      <div class="quiz-options">
        ${question.options.map((option) => `
          <label class="quiz-option">
            <input type="radio" name="quiz-option" value="${escapeHtml(option)}" />
            <span>${escapeHtml(option)}</span>
          </label>`).join("")}
      </div>
    </div>`;
  elements.quizAnswerButton.disabled = true;
  elements.quizError.textContent = "";
}

function answerQuiz() {
  const selected = elements.quizBody.querySelector("input[name='quiz-option']:checked");
  if (!selected || !quizData) return;
  const question = quizData.questions[quizData.index];
  const correct = selected.value === question.answer;
  elements.quizBody.querySelectorAll(".quiz-option").forEach((label) => {
    const input = label.querySelector("input");
    input.disabled = true;
    if (input.value === question.answer) label.classList.add("correct");
    else if (input.checked) label.classList.add("wrong");
  });
  elements.quizAnswerButton.disabled = true;
  quizData.answers.push(correct);
  window.setTimeout(() => {
    if (quizData.index < quizData.questions.length - 1) {
      quizData.index += 1;
      renderQuizQuestion();
    } else {
      finishQuiz();
    }
  }, correct ? 750 : 1700);
}

function finishQuiz() {
  const allCorrect = quizData.answers.length === quizData.questions.length && quizData.answers.every(Boolean);
  const task = state.tasks.find((item) => item.id === verifyTaskId);
  if (allCorrect && task) {
    task.verified = true;
    persist();
    render();
    finishVerification("验收通过！", accountUser ? "3 题全对，经验 +10 已到账！" : "3 题全对！登录后可以获得经验。");
  } else {
    elements.verifyQuizPanel.hidden = true;
    elements.verifyResultPanel.hidden = false;
    document.querySelector("#verify-result-icon").innerHTML = '<i data-lucide="rotate-ccw"></i>';
    document.querySelector("#verify-result-title").textContent = "差一点点！";
    document.querySelector("#verify-result-text").textContent = "有单词答错了，单词已保存在单词本里。关闭后点击任务上的「验收」可以重新挑战。";
    document.querySelector("#verify-result-close").textContent = "再试一次";
    refreshIcons();
  }
}

async function finishVerification(title, text) {
  elements.verifySubmitPanel.hidden = true;
  elements.verifyQuizPanel.hidden = true;
  elements.verifyResultPanel.hidden = false;
  document.querySelector("#verify-result-icon").innerHTML = '<i data-lucide="party-popper"></i>';
  document.querySelector("#verify-result-title").textContent = title;
  document.querySelector("#verify-result-text").textContent = text;
  document.querySelector("#verify-result-close").textContent = "太好了";
  refreshIcons();
  if (accountUser) await requestTaskXp("task");
}

function renderWords() {
  if (!elements.wordList) return;
  const words = state.words || [];
  elements.wordCount.textContent = `${words.length} 词`;
  elements.wordList.innerHTML = words.length
    ? words.slice(0, 60).map((entry) => `
      <div class="word-item">
        <strong>${escapeHtml(entry.word)}</strong>
        <span>${escapeHtml(entry.meaning || "释义待补充")}</span>
        <time>${escapeHtml(entry.date || "")}</time>
      </div>`).join("")
    : '<p class="word-empty">还没有单词。提交英语任务验收时填写的单词会自动记录在这里。</p>';
}

function formatBytes(bytes) {
  const units = ["B", "KB", "MB", "GB"];
  let value = Number(bytes) || 0;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value >= 100 || unit === 0 ? 0 : 1)} ${units[unit]}`;
}

function fileIconFor(name, type) {
  const extension = (name.split(".").pop() || "").toLowerCase();
  if (["js", "ts", "jsx", "tsx", "py", "java", "c", "cpp", "cs", "go", "rs", "rb", "php", "html", "css", "json", "xml", "sh", "sql"].includes(extension)) return "file-code-2";
  if (String(type || "").startsWith("image/") || ["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(extension)) return "image";
  if (["zip", "rar", "7z", "tar", "gz"].includes(extension)) return "file-archive";
  if (["md", "txt", "doc", "docx", "pdf"].includes(extension)) return "file-text";
  return "file";
}

async function loadFiles() {
  if (!accountUser || !elements.fileList) return;
  try {
    const response = await fetch("/api/files", { credentials: "same-origin", headers: { Accept: "application/json" } });
    if (response.status === 401) return;
    if (!response.ok) throw new Error("load failed");
    const data = await response.json();
    renderFiles(data);
  } catch {
    elements.fileList.innerHTML = '<p class="file-empty">文件列表暂时无法加载，请点右上角刷新重试。</p>';
  }
}

function renderFiles(data) {
  const usage = data.usage || {};
  const quotaBytes = usage.quota || 1024 * 1024 * 1024;
  const usedBytes = usage.used || 0;
  if (elements.storageUsed) elements.storageUsed.textContent = `${formatBytes(usedBytes)} / ${formatBytes(quotaBytes)}`;
  if (elements.storageFilesCount) elements.storageFilesCount.textContent = `${usage.count || 0} 个文件`;
  if (elements.storageFill) {
    elements.storageFill.style.width = `${Math.min(100, (usedBytes / quotaBytes) * 100).toFixed(1)}%`;
  }
  if (elements.storageLevelNote) {
    elements.storageLevelNote.textContent = usage.isAdmin
      ? "站长特权 · 专属 3GB 云存储"
      : usage.level
      ? `当前 Lv.${usage.level} 境界 · 每提升 1 级容量 +100MB，最高 1GB`
      : "每提升 1 级境界，容量 +100MB，最高 1GB";
  }
  elements.fileList.innerHTML = data.files?.length
    ? data.files.map((file) => `
      <div class="file-item">
        <span class="file-icon"><i data-lucide="${fileIconFor(file.name, file.type)}"></i></span>
        <div class="file-info">
          <span class="file-name" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</span>
          <span class="file-meta">${formatBytes(file.size)} · ${formatDate(new Date(file.createdAt).toISOString().slice(0, 10))}</span>
        </div>
        <div class="file-actions">
          <a class="mini-button" href="/api/files/${file.id}/download" download>下载</a>
          <button class="mini-button" type="button" data-delete-file="${file.id}">删除</button>
        </div>
      </div>`).join("")
    : '<p class="file-empty">还没有文件，点「上传文件」把代码或学习资料存进来。</p>';
  refreshIcons();
}

function handleFileSelect(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  uploadFileWithProgress(file);
  event.target.value = "";
}

function uploadFileWithProgress(file) {
  if (!accountUser) {
    showToast("请先登录再上传文件。");
    return;
  }
  const form = new FormData();
  form.append("file", file);
  const xhr = new XMLHttpRequest();
  elements.uploadProgress.hidden = false;
  elements.uploadName.textContent = `正在上传：${file.name}`;
  elements.uploadProgressFill.style.width = "0%";
  xhr.upload.addEventListener("progress", (event) => {
    if (!event.lengthComputable) return;
    const percent = Math.round((event.loaded / event.total) * 100);
    elements.uploadProgressFill.style.width = `${percent}%`;
    elements.uploadName.textContent = `正在上传：${file.name}（${percent}%）`;
  });
  xhr.addEventListener("load", async () => {
    elements.uploadProgress.hidden = true;
    try {
      const data = JSON.parse(xhr.responseText || "{}");
      if (xhr.status >= 200 && xhr.status < 300) {
        showToast(`「${data.file?.name || file.name}」已存入云存储`);
        await loadFiles();
      } else {
        showToast(data.error || "上传失败，请重试。");
      }
    } catch {
      showToast("上传失败，请重试。");
    }
  });
  xhr.addEventListener("error", () => {
    elements.uploadProgress.hidden = true;
    showToast("网络异常，上传失败。");
  });
  xhr.open("POST", "/api/files");
  xhr.withCredentials = true;
  xhr.send(form);
}

async function handleFileAction(event) {
  const button = event.target.closest("[data-delete-file]");
  if (!button) return;
  if (!window.confirm("确定删除这个文件吗？删除后无法恢复。")) return;
  try {
    const response = await fetch(`/api/files/${button.dataset.deleteFile}`, { method: "DELETE", credentials: "same-origin" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "删除失败。");
    showToast("文件已删除");
    await loadFiles();
  } catch (error) {
    showToast(error.message || "删除失败");
  }
}

async function handleCheckin() {
  if (!accountUser || !elements.checkinButton) return;
  elements.checkinButton.disabled = true;
  try {
    const response = await fetch("/api/profile/checkin", { method: "POST", credentials: "same-origin", headers: { Accept: "application/json" } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "签到失败，请稍后再试。");
    profileCache = data.profile;
    applyProfileUi();
    showToast(data.leveledUp ? `签到成功，突破【${data.profile.level.name}】！` : `签到成功 +${data.gain} XP`);
  } catch (error) {
    showToast(error.message || "签到失败");
    elements.checkinButton.disabled = !!profileCache?.checkin?.checkedInToday;
  }
}

async function saveDisplayName(event) {
  event.preventDefault();
  const value = elements.displayNameInput?.value.trim();
  if (!value) return showToast("请输入 1 到 16 个字的道号");
  try {
    const response = await fetch("/api/profile", {
      method: "PUT", credentials: "same-origin",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ displayName: value }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "保存失败。");
    profileCache = data.profile;
    applyProfileUi();
    showToast(`道号已定为「${value}」`);
    loadLeaderboard();
  } catch (error) {
    showToast(error.message || "保存失败");
  }
}

function resizeAvatarToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("图片读取失败。"));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error("图片格式无法识别。"));
      image.onload = () => {
        const size = 128;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const context = canvas.getContext("2d");
        const side = Math.min(image.naturalWidth, image.naturalHeight);
        context.drawImage(
          image,
          (image.naturalWidth - side) / 2,
          (image.naturalHeight - side) / 2,
          side,
          side,
          0,
          0,
          size,
          size,
        );
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

async function handleAvatarSelect(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  if (file.size > 8 * 1024 * 1024) return showToast("图片不能超过 8MB。");
  try {
    const avatar = await resizeAvatarToDataUrl(file);
    const response = await fetch("/api/profile", {
      method: "PUT", credentials: "same-origin",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ avatar }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "头像上传失败。");
    profileCache = data.profile;
    applyProfileUi();
    showToast("头像已更新");
    loadLeaderboard();
  } catch (error) {
    showToast(error.message || "头像上传失败");
  } finally {
    event.target.value = "";
  }
}

async function removeAvatar() {
  try {
    const response = await fetch("/api/profile", {
      method: "PUT", credentials: "same-origin",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ avatar: "" }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "移除失败。");
    profileCache = data.profile;
    applyProfileUi();
    showToast("已恢复默认图标");
    loadLeaderboard();
  } catch (error) {
    showToast(error.message || "移除失败");
  }
}

function renderWorkspaceStats() {
  if (!elements.statsDonut || !elements.statsBars) return;
  const days = [];
  for (let offset = 6; offset >= 0; offset -= 1) {
    const date = new Date(Date.now() - offset * 86400 * 1000);
    days.push(getLocalDate(date));
  }
  const recent = state.tasks.filter((task) => task.completed && days.includes(task.date));
  const counts = days.map((day) => recent.filter((task) => task.date === day).length);
  const total = recent.length;
  const hasData = total > 0;
  if (elements.statsEmpty) elements.statsEmpty.hidden = hasData;
  if (elements.statsGrid) elements.statsGrid.hidden = !hasData;
  if (!hasData) return;

  const categoryColors = { work: "#2563eb", software: "#7c3aed", english: "#f59e0b" };
  const segments = Object.keys(categoryLabels)
    .map((key) => ({ key, label: categoryLabels[key], color: categoryColors[key], count: recent.filter((task) => task.category === key).length }))
    .filter((segment) => segment.count > 0);
  const circumference = 2 * Math.PI * 15.9155;
  let offset = 0;
  const circles = segments.map((segment) => {
    const length = (segment.count / total) * circumference;
    const circle = `<circle cx="21" cy="21" r="15.9155" stroke="${segment.color}" stroke-dasharray="${length} ${circumference - length}" stroke-dashoffset="${-offset}"></circle>`;
    offset += length;
    return circle;
  });
  elements.statsDonut.innerHTML = `<circle cx="21" cy="21" r="15.9155" stroke="#e2e8f0" stroke-dasharray="${circumference} 0"></circle>${circles.join("")}`;
  elements.donutCenter.textContent = total;
  elements.donutLegend.innerHTML = segments
    .map((segment) => `<span><i style="background:${segment.color}"></i>${segment.label} ${Math.round((segment.count / total) * 100)}%（${segment.count}）</span>`)
    .join("");

  const maxCount = Math.max(...counts, 1);
  const weekdayNames = ["日", "一", "二", "三", "四", "五", "六"];
  elements.statsBars.innerHTML = counts
    .map((count, index) => `
      <div class="bar-col ${index === 6 ? "today" : ""}">
        <span class="bar-count">${count || ""}</span>
        <div class="bar-fill" style="height:${Math.max(3, (count / maxCount) * 100)}%"></div>
      </div>`).join("");
  elements.statsBarLabels.innerHTML = days
    .map((day, index) => {
      const date = new Date(`${day}T00:00:00`);
      return `<span>${index === 6 ? "今天" : `周${weekdayNames[date.getDay()]}`}</span>`;
    }).join("");
}

async function loadFriends() {
  if (!accountUser) return;
  try {
    const response = await fetch("/api/friends", { credentials: "same-origin", headers: { Accept: "application/json" } });
    if (!response.ok) return;
    const data = await response.json();
    friendsCache = data;
    renderFriends();
  } catch { /* friends load retries when workspace opens */ }
}

function renderFriends() {
  if (!elements.friendsList) return;
  if (elements.incomingBlock) elements.incomingBlock.hidden = !friendsCache.incoming?.length;
  if (elements.incomingList) {
    elements.incomingList.innerHTML = friendsCache.incoming?.map((item) => `
      <div class="friend-item">
        <span class="friend-name">${escapeHtml(item.displayName)}</span>
        <button class="mini-button" type="button" data-respond="accept" data-id="${item.friendshipId}">同意</button>
        <button class="mini-button" type="button" data-respond="reject" data-id="${item.friendshipId}">拒绝</button>
      </div>`).join("") || "";
  }
  elements.friendsList.innerHTML = friendsCache.friends?.length
    ? friendsCache.friends.map((item) => `
      <div class="friend-item">
        <span class="friend-name">${escapeHtml(item.displayName)}</span>
        <span class="friend-level">Lv.${item.level} ${escapeHtml(item.levelName)}</span>
      </div>`).join("")
    : '<p class="friend-empty">还没有好友，输入对方邮箱发出第一个申请吧。</p>';
  renderCollabFriendSelect();
}

async function sendFriendRequest(event) {
  event.preventDefault();
  const email = elements.friendEmail?.value.trim();
  if (!email) return;
  try {
    const response = await fetch("/api/friends", {
      method: "POST", credentials: "same-origin",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "发送失败。");
    showToast(data.message || "好友申请已发送。");
    elements.friendEmail.value = "";
    await loadFriends();
  } catch (error) {
    showToast(error.message || "发送失败");
  }
}

async function handleFriendRespond(event) {
  const button = event.target.closest("[data-respond]");
  if (!button) return;
  try {
    const response = await fetch("/api/friends/respond", {
      method: "POST", credentials: "same-origin",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ id: button.dataset.id, action: button.dataset.respond }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "操作失败。");
    showToast(data.message || "操作成功。");
    await loadFriends();
  } catch (error) {
    showToast(error.message || "操作失败");
  }
}

function renderCollabFriendSelect() {
  if (!elements.collabFriendSelect) return;
  const options = friendsCache.friends?.map((friend) =>
    `<option value="${friend.userId}">${escapeHtml(friend.displayName)}（Lv.${friend.level}）</option>`).join("");
  elements.collabFriendSelect.innerHTML = options || '<option value="">先添加好友</option>';
}

async function loadCollabTasks() {
  if (!accountUser) return;
  try {
    const response = await fetch("/api/collab", { credentials: "same-origin", headers: { Accept: "application/json" } });
    if (!response.ok) return;
    const data = await response.json();
    renderCollabTasks(data.tasks || []);
  } catch { /* collab load retries when workspace opens */ }
}

function renderCollabTasks(tasks) {
  if (!elements.collabList) return;
  elements.collabList.innerHTML = tasks.length
    ? tasks.map((task) => `
      <div class="collab-item ${task.done ? "done" : ""}">
        <input class="collab-check" type="checkbox" data-toggle-id="${task.id}" ${task.done ? "checked" : ""} aria-label="完成${escapeHtml(task.title)}" />
        <div class="collab-body">
          <span class="collab-title">${escapeHtml(task.title)}</span>
          <span class="collab-meta">
            <span class="collab-tag">${categoryLabels[task.category] || "工作"}</span>
            <span>与 ${escapeHtml(task.partnerName)}</span>
            ${task.estimate ? `<span>预计 ${escapeHtml(task.estimate)}</span>` : ""}
            ${task.iAmOwner ? "<span>我发起</span>" : ""}
          </span>
        </div>
        ${task.iAmOwner ? `<button class="mini-button" type="button" data-delete-id="${task.id}">删除</button>` : ""}
      </div>`).join("")
    : '<p class="collab-empty">还没有协作任务，和好友一起立一个目标吧。</p>';
}

async function createCollabTask(event) {
  event.preventDefault();
  const title = elements.collabTitleInput?.value.trim();
  const friendId = elements.collabFriendSelect?.value;
  if (!title || !friendId) return showToast("请填写标题并选择好友。");
  try {
    const response = await fetch("/api/collab", {
      method: "POST", credentials: "same-origin",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ title, friendId, category: elements.collabCategory?.value || "work" }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "创建失败。");
    showToast("协作任务已创建");
    elements.collabTitleInput.value = "";
    await loadCollabTasks();
  } catch (error) {
    showToast(error.message || "创建失败");
  }
}

async function handleCollabToggle(event) {
  const checkbox = event.target.closest("[data-toggle-id]");
  if (!checkbox) return;
  const id = checkbox.dataset.toggleId;
  try {
    const response = await fetch(`/api/collab/${id}`, {
      method: "PATCH", credentials: "same-origin",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ done: checkbox.checked }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "操作失败。");
    if (checkbox.checked) {
      const mine = data.xp?.owner?.awarded ? data.xp.owner : data.xp?.friend;
      if (mine?.awarded) {
        await loadProfile();
        if (mine.leveledUp) showToast(`协作完成，突破【${profileCache.level.name}】！`);
        else showToast(`协作完成 +${mine.gain} XP`);
      } else {
        showToast("协作任务完成");
      }
    } else {
      showToast("任务已恢复进行中");
    }
    await loadCollabTasks();
  } catch (error) {
    showToast(error.message || "操作失败");
    await loadCollabTasks();
  }
}

async function handleCollabDelete(event) {
  const button = event.target.closest("[data-delete-id]");
  if (!button) return;
  if (!window.confirm("确定删除这个协作任务吗？")) return;
  try {
    const response = await fetch(`/api/collab/${button.dataset.deleteId}`, { method: "DELETE", credentials: "same-origin" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "删除失败。");
    showToast("协作任务已删除");
    await loadCollabTasks();
  } catch (error) {
    showToast(error.message || "删除失败");
  }
}

async function loadLeaderboard() {
  if (!elements.leaderboardList) return;
  elements.leaderboardList.innerHTML = '<p class="plaza-empty">正在加载修真榜…</p>';
  try {
    const response = await fetch("/api/leaderboard", { credentials: "same-origin", cache: "no-store", headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error("load failed");
    const data = await response.json();
    const entries = data.entries || [];
    if (!entries.length) {
      elements.leaderboardList.innerHTML = '<p class="plaza-empty">榜上还没有修行者，签到和完成任务即可上榜。</p>';
      return;
    }
    const avatarOf = (entry) => entry.avatar
      ? `<img src="${entry.avatar}" alt="${escapeHtml(entry.displayName)}的头像" />`
      : escapeHtml((entry.displayName || "无").slice(0, 1));
    const spot = (entry, position) => entry ? `
      <div class="podium-spot ${position}">
        <span class="podium-rank">NO.${entry.rank}</span>
        <span class="podium-avatar">${avatarOf(entry)}</span>
        <span class="podium-name">${escapeHtml(entry.displayName)}${entry.isAdmin ? '<span class="admin-badge">👑 站长</span>' : ""}</span>
        <span class="level-pill">Lv.${entry.level} ${escapeHtml(entry.levelName)}</span>
        <span class="podium-xp">${entry.xp} XP</span>
      </div>` : '<div class="podium-spot" aria-hidden="true"></div>';
    const podium = `
      <div class="podium">
        ${spot(entries[1], "second")}
        ${spot(entries[0], "first")}
        ${spot(entries[2], "third")}
      </div>`;
    const rest = entries.slice(3, 10);
    const restList = rest.length ? `
      <ol class="leaderboard-rest">
        ${rest.map((entry) => `
          <li>
            <span class="rank-badge">${entry.rank}</span>
            <span class="lb-name">${escapeHtml(entry.displayName)}${entry.isAdmin ? '<span class="admin-badge">👑 站长</span>' : ""}</span>
            <span class="level-pill">Lv.${entry.level} ${escapeHtml(entry.levelName)}</span>
            <span class="lb-xp">${entry.xp} XP</span>
          </li>`).join("")}
      </ol>` : "";
    elements.leaderboardList.innerHTML = podium + restList;
    refreshIcons();
    if (elements.myRankCard) {
      const mine = data.myRank;
      elements.myRankCard.hidden = !mine;
      if (mine) elements.myRankCard.innerHTML = `<span class="level-pill">我的排名</span><strong>第 ${mine.rank} 名</strong><span class="lb-xp">Lv.${mine.level} ${escapeHtml(mine.name)} · ${mine.xp} XP</span>`;
    }
  } catch {
    elements.leaderboardList.innerHTML = '<p class="plaza-empty">排行榜暂时无法加载，请稍后刷新。</p>';
  }
}

function restoreView() {
  const view = window.location.hash.slice(1);
  currentView = viewTitles[view] ? view : "dashboard";
  switchView(view);
  if (view === "ai") toggleChat(true);
}

function toggleChat(open) {
  if (open && elements.chatWindow.hidden)
    chatReturnFocus = document.activeElement;
  elements.chatWindow.hidden = !open;
  syncChatMode();
  document
    .querySelectorAll("[data-chat-toggle]")
    .forEach((button) => button.setAttribute("aria-expanded", open));
  elements.chatLauncher.setAttribute(
    "aria-label",
    open ? "收起 AI 助手" : "打开 AI 助手",
  );
  elements.chatLauncher.title = open ? "收起 AI 助手" : "打开 AI 助手";
  if (open) {
    document.querySelector(".unread-dot").hidden = true;
    elements.chatInput.focus({ preventScroll: true });
    elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
  } else if (elements.chatWindow.contains(document.activeElement)) {
    (chatReturnFocus?.isConnected
      ? chatReturnFocus
      : elements.chatLauncher
    ).focus({ preventScroll: true });
  }
}

function toggleChatSize() {
  const expanded = elements.chatWindow.classList.toggle("is-expanded");
  syncChatMode();
  const button = document.querySelector("#expand-chat-button");
  button.setAttribute("aria-pressed", expanded);
  button.setAttribute("aria-label", expanded ? "还原聊天窗" : "放大聊天窗");
  button.title = expanded ? "还原聊天窗" : "放大聊天窗";
  button.innerHTML = `<i data-lucide="${expanded ? "minimize-2" : "maximize-2"}"></i>`;
  refreshIcons();
}

function syncChatMode() {
  const fullscreen =
    !elements.chatWindow.hidden &&
    window.innerWidth < 768;
  document.documentElement.classList.toggle("chat-fullscreen", fullscreen);
  document.querySelector(".app-shell").inert = fullscreen;
  elements.chatLauncher.inert = fullscreen;
  elements.chatWindow.setAttribute("aria-modal", fullscreen);
}

function fillChatPrompt(prompt) {
  toggleChat(true);
  if (elements.chatInput.value.trim()) {
    showToast("输入框中有未发送内容，请先发送或清除");
    return;
  }
  elements.chatInput.value = prompt;
  updateComposer();
  persistChat();
}

function selectModel(model) {
  if (
    chatController ||
    model === activeModel ||
    !["deepseek", "codex"].includes(model)
  )
    return;
  persistChat();
  activeModel = model;
  chatMessages = chatState.conversations[model];
  elements.chatInput.value = chatState.drafts[model];
  elements.modelNote.textContent = modelNotes[model];
  renderChatMessages();
  updateComposer();
  persistChat();
}

async function sendChatMessage(event, retry = false) {
  event?.preventDefault();
  const lastUserIndex = chatMessages.findLastIndex(
    (message) => message.role === "user",
  );
  const content = retry
    ? chatMessages[lastUserIndex]?.content
    : elements.chatInput.value.trim();
  if (!content || chatController) return;

  if (!retry && executeLocalAgentIntent(content)) return;

  if (retry) chatMessages.splice(lastUserIndex + 1);
  else chatMessages.push({ role: "user", content });
  const selectedModel = activeModel;
  if (!retry) elements.chatInput.value = "";
  chatController = new AbortController();
  let timedOut = false;
  const timeout = window.setTimeout(() => {
    timedOut = true;
    chatController?.abort();
  }, 120000);
  setChatLoading(true);
  renderChatMessages();
  persistChat();

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: selectedModel,
        messages: chatMessages
          .filter(
            (message) => message.role !== "error" && message.content.trim(),
          )
          .slice(-12)
          .map(({ role, content }) => ({
            role,
            content: content.slice(0, 4000),
          })),
      }),
      signal: chatController.signal,
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || "AI 暂时无法回复，请稍后再试。");
    }
    if (!response.headers.get("Content-Type")?.includes("text/plain")) {
      throw new Error("当前地址未连接 AI 接口，请从已部署的网站打开对话。");
    }
    if (!response.body) throw new Error("浏览器无法读取 AI 回复流。");

    const assistantIndex =
      chatMessages.push({
        role: "assistant",
        content: "",
        model: selectedModel,
      }) - 1;
    renderChatMessages();

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      if (chunk) appendAssistantChunk(assistantIndex, chunk);
    }
    const finalChunk = decoder.decode();
    if (finalChunk) appendAssistantChunk(assistantIndex, finalChunk);
    if (!chatMessages[assistantIndex].content.trim()) {
      chatMessages.splice(assistantIndex, 1);
      throw new Error("AI 没有返回可显示的内容，请重试。");
    }
    applyModelAgentAction(assistantIndex);
  } catch (error) {
    removeEmptyAssistantMessage();
    const partial = chatMessages.at(-1);
    if (partial?.role === "assistant") partial.interrupted = true;
    if (error.name === "AbortError" && !timedOut) {
      showToast("已停止生成");
    } else {
      chatMessages.push({
        role: "error",
        content: timedOut
          ? "等待回复超时，请重试。"
          : error.message || "连接中断，请重试。",
      });
    }
  } finally {
    window.clearTimeout(timeout);
    chatController = null;
    setChatLoading(false);
    renderChatMessages(false);
    persistChat();
    if (elements.chatWindow.hidden)
      document.querySelector(".unread-dot").hidden = false;
  }
}

function executeLocalAgentIntent(content) {
  const intent = parseLocalAgentIntent(content);
  if (!intent) return false;

  chatMessages.push({ role: "user", content });
  const result = executeAgentAction(intent, { confirmDelete: true });
  chatMessages.push({
    role: "assistant",
    model: activeModel,
    localAction: true,
    content: result.message,
  });
  elements.chatInput.value = "";
  updateComposer();
  renderChatMessages();
  persistChat();
  if (result.changed) showToast(result.toast || "Agent 已执行");
  return true;
}

function parseLocalAgentIntent(content) {
  const value = content.trim().replace(/[。！!]+$/u, "");
  const add = value.match(
    /^(?:请|帮我|给我)?(?:添加|新增|创建|安排)(?:一个|一项)?(?:任务)?[：:,，\s]*(.+)$/u,
  );
  if (add) {
    const raw = add[1]
      .trim()
      .replace(/(?:到|进|加入到?)(?:今天|今日)(?:的)?任务(?:列表|中|里)?$/u, "")
      .replace(/(?:作为)?(?:今天|今日)(?:的)?任务$/u, "")
      .trim();
    const minutes = Number(raw.match(/(\d{1,3})\s*(?:分钟|分)/u)?.[1] || 30);
    const title = raw
      .replace(/\d{1,3}\s*(?:分钟|分)/gu, "")
      .replace(/^(?:工作|软件|英语)(?:任务)?[：:,，\s]+/u, "")
      .trim();
    if (title) {
      const category = /英语|词汇|听力|口语/u.test(raw)
        ? "english"
        : /软件|代码|编程|ROS|Linux|开发/u.test(raw)
          ? "software"
          : "work";
      return {
        type: "task.create",
        args: { title: title.slice(0, 80), category, date: agentDate(raw), minutes: clampMinutes(minutes), notes: "" },
      };
    }
  }

  const complete = value.match(
    /^(?:请|帮我)?(?:完成|勾选|标记)(?:任务)?[：:,，\s]+(.+)$/u,
  );
  if (complete) return { type: "task.complete", target: { title: complete[1].trim().slice(0, 80), date: agentDate(complete[1]) } };

  const remove = value.match(
    /^(?:请|帮我)?(?:删除|删掉|移除)(?:任务)?[：:,，\s]*(.+)$/u,
  );
  if (remove) return { type: "task.delete", target: { title: remove[1].trim().slice(0, 80), date: agentDate(remove[1]) } };

  const record = value.match(
    /^(?:请|帮我)?(?:记录|保存)(?:一下)?(?:这周|本周)?(?:成果|工作记录|工作日志)?[：:,，\s]+(.+)$/u,
  );
  if (record) {
    const details = record[1].trim().slice(0, 800);
    const separator = details.search(/[；;。]/u);
    const title = separator > 0 ? details.slice(0, separator).trim() : "本周成果";
    return { type: "record.create", args: { date: today, title: title.slice(0, 60), details } };
  }

  if (/^(?:请|帮我)?(?:查看|总结|汇总)(?:一下)?本周成果$/u.test(value))
    return { type: "week.summary" };
  return null;
}

function executeAgentAction(action, options = {}) {
  if (!action || typeof action.type !== "string") return { handled: false, changed: false, message: "我没有识别到可执行的操作。" };
  if (action.type === "task.create") {
    const args = action.args || {};
    const title = String(args.title || "").trim().slice(0, 80);
    if (!title) return { handled: true, changed: false, message: "请告诉我要添加的任务名称。" };
    const task = { id: createId(), title, category: ["work", "software", "english"].includes(args.category) ? args.category : "work", date: validAgentDate(args.date) || today, minutes: clampMinutes(args.minutes), notes: String(args.notes || "").trim().slice(0, 800), completed: false, createdAt: new Date().toISOString() };
    state.tasks.push(task);
    persist();
    render();
    return { handled: true, changed: true, toast: "任务已添加", message: `✅ 已添加任务：**${escapeMarkdown(task.title)}**（${categoryLabels[task.category]} · ${task.minutes} 分钟）` };
  }

  if (action.type === "task.complete") {
    const task = findAgentTask(action.target);
    if (!task) return { handled: true, changed: false, message: "没有找到唯一匹配的任务，请提供完整任务名称。" };
    if (task.completed) return { handled: true, changed: false, message: `这项任务已经完成：**${escapeMarkdown(task.title)}**` };
    task.completed = true;
    persist();
    render();
    return { handled: true, changed: true, toast: "任务已完成", message: `✅ 已完成任务：**${escapeMarkdown(task.title)}**` };
  }

  if (action.type === "task.delete") {
    const candidates = findAgentTasks(action.target);
    if (!candidates.length) return { handled: true, changed: false, message: "没有找到匹配的任务，请提供完整任务名称。" };
    if (candidates.length > 1) return { handled: true, changed: false, message: "找到多项相似任务，请补充任务名称或日期后再删除。" };
    const task = candidates[0];
    if (options.confirmDelete && !window.confirm(`确定删除任务“${task.title}”吗？`)) return { handled: true, changed: false, message: "已取消删除，任务仍然保留。" };
    state.tasks = state.tasks.filter((item) => item.id !== task.id);
    persist();
    render();
    return { handled: true, changed: true, toast: "任务已删除", message: `✅ 已删除任务：**${escapeMarkdown(task.title)}**` };
  }

  if (action.type === "record.create") {
    const args = action.args || {};
    const details = String(args.details || "").trim().slice(0, 800);
    if (!details) return { handled: true, changed: false, message: "请补充要记录的成果内容。" };
    const record = { id: createId(), date: validAgentDate(args.date) || today, title: String(args.title || "本周成果").trim().slice(0, 60), details, createdAt: new Date().toISOString() };
    state.records.unshift(record);
    persist();
    renderRecords();
    return { handled: true, changed: true, toast: "工作记录已保存", message: `✅ 已记录成果：**${escapeMarkdown(record.title)}**` };
  }

  if (action.type === "week.summary") {
    const monday = new Date(`${today}T12:00:00`);
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    const records = state.records.filter((record) => record.date >= formatAgentDate(monday));
    const completed = state.tasks.filter((task) => task.completed && task.date >= formatAgentDate(monday));
    const lines = [`### 本周成果`, `- 完成任务：${completed.length} 项`, `- 工作记录：${records.length} 条`];
    if (records.length) lines.push(...records.slice(0, 5).map((record) => `- ${record.title}`));
    return { handled: true, changed: false, message: lines.join("\n") };
  }
  return { handled: false, changed: false, message: "我暂时不能执行这项操作。" };
}

function applyModelAgentAction(index) {
  const message = chatMessages[index];
  if (!message || message.role !== "assistant") return;
  const extracted = extractModelAgentAction(message.content);
  if (!extracted) return;
  message.content = extracted.visible;
  if (!extracted.action) return;
  const result = executeAgentAction(extracted.action, { confirmDelete: true });
  if (result.handled) message.content = `${message.content}\n\n${result.message}`.trim();
}

function extractModelAgentAction(content) {
  const marker = /(?:<|&lt;)?\/?c?areer-action(?:>|&gt;)/i;
  const match = marker.exec(content);
  if (!match) return null;
  const visible = content.slice(0, match.index).trim();
  const jsonStart = content.indexOf("{", match.index + match[0].length);
  if (jsonStart === -1) return { action: null, visible };

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = jsonStart; index < content.length; index += 1) {
    const character = content[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') inString = true;
    else if (character === "{") depth += 1;
    else if (character === "}") {
      depth -= 1;
      if (depth === 0) {
        try {
          return { action: JSON.parse(content.slice(jsonStart, index + 1)), visible };
        } catch {
          return { action: null, visible };
        }
      }
    }
  }
  return { action: null, visible };
}

function visibleAgentText(content) {
  const marker = /(?:<|&lt;)?\/?c?areer-action(?:>|&gt;)/i.exec(content);
  return marker ? content.slice(0, marker.index).trimEnd() : content;
}

function findAgentTasks(target = {}) {
  const title = String(target.title || "").trim().replace(/[。！!]+$/u, "");
  if (!title) return [];
  const date = validAgentDate(target.date);
  const matchesDate = (task) => !date || task.date === date;
  const exact = state.tasks.filter((task) => task.title === title && matchesDate(task));
  if (exact.length) return exact;
  const normalizedTitle = normalizeAgentTaskTitle(title);
  if (normalizedTitle.length >= 2) {
    const normalized = state.tasks.filter(
      (task) => normalizeAgentTaskTitle(task.title) === normalizedTitle && matchesDate(task),
    );
    if (normalized.length) return normalized;
    return state.tasks.filter((task) => {
      const candidate = normalizeAgentTaskTitle(task.title);
      return candidate.length >= 2 &&
        (candidate.includes(normalizedTitle) || normalizedTitle.includes(candidate)) &&
        matchesDate(task);
    });
  }
  return state.tasks.filter((task) =>
    (task.title.includes(title) || title.includes(task.title)) && matchesDate(task),
  );
}

function normalizeAgentTaskTitle(value) {
  return String(value || "")
    .replace(/\s+/gu, "")
    .replace(/(?:今天|今日|明天|任务|计划|日程|安排|加入|添加|到|的)/gu, "")
    .replace(/[：:,，。！!、]/gu, "")
    .toLowerCase();
}

function findAgentTask(target) {
  const candidates = findAgentTasks(target);
  return candidates.length === 1 ? candidates[0] : null;
}

function agentDate(value) {
  const text = String(value || "");
  if (/明天/u.test(text)) { const date = new Date(`${today}T12:00:00`); date.setDate(date.getDate() + 1); return formatAgentDate(date); }
  return today;
}

function validAgentDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/u.test(String(value || "")) ? String(value) : "";
}

function formatAgentDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function clampMinutes(value) {
  const minutes = Number(value);
  return Number.isFinite(minutes) ? Math.min(480, Math.max(5, Math.round(minutes))) : 30;
}

function escapeMarkdown(value) {
  return String(value).replace(/[\\`*_{}[\]()#+.!|>-]/g, "\\$&");
}

function appendAssistantChunk(index, chunk) {
  const message = chatMessages[index];
  if (!message || message.role !== "assistant") return;
  const follow = isNearChatBottom();
  message.content += chunk;
  const contentNode = elements.chatMessages.querySelector(
    `[data-message-index="${index}"] .message-content`,
  );
  if (contentNode) contentNode.textContent = visibleAgentText(message.content);
  elements.chatMessages.querySelector(".typing-indicator")?.remove();
  elements.chatStatus.textContent = "AI 正在回答…";
  if (follow)
    elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
}

function removeEmptyAssistantMessage() {
  const lastMessage = chatMessages.at(-1);
  if (lastMessage?.role === "assistant" && !lastMessage.content)
    chatMessages.pop();
}

function stopChatRequest() {
  chatController?.abort();
}

function clearChat() {
  if (chatController) return;
  if (
    chatMessages.length &&
    !window.confirm("新建对话将清除当前模型的聊天记录，继续吗？")
  )
    return;
  chatMessages = [];
  chatState.conversations[activeModel] = chatMessages;
  persistChat();
  renderChatMessages();
  showToast("已新建对话");
}

async function copyChatMessage(event) {
  const button = event.target.closest("[data-copy-message]");
  if (!button) return;
  const message = chatMessages[Number(button.dataset.copyMessage)];
  if (!message) return;
  try {
    await navigator.clipboard.writeText(message.content);
    showToast("回复已复制");
  } catch {
    showToast("复制失败，请手动选择文字");
  }
}

function setChatLoading(isLoading) {
  updateComposer();
  elements.sendChatButton.hidden = isLoading;
  elements.stopChatButton.hidden = !isLoading;
  elements.chatStatus.textContent = isLoading
    ? "AI 正在思考…"
    : "AI 回答仅供参考";
  elements.chatModel.disabled = isLoading;
  document.querySelector("#clear-chat-button").disabled = isLoading;
  elements.chatMessages.setAttribute("aria-busy", isLoading);
}

function updateComposer() {
  elements.sendChatButton.disabled =
    !!chatController || !elements.chatInput.value.trim();
  elements.chatInput.style.height = "auto";
  elements.chatInput.style.height = `${Math.min(124, Math.max(62, elements.chatInput.scrollHeight))}px`;
}

function isNearChatBottom() {
  return (
    elements.chatMessages.scrollHeight -
      elements.chatMessages.scrollTop -
      elements.chatMessages.clientHeight <
    90
  );
}

function renderChatMessages(forceScroll = true) {
  const follow = forceScroll || isNearChatBottom();
  const oldScroll = elements.chatMessages.scrollTop;
  if (!chatMessages.length) {
    elements.chatMessages.innerHTML = `
      <div class="chat-welcome">
        <span class="welcome-symbol"><i data-lucide="sparkles"></i></span>
        <h3>今天，一起解决什么？</h3>
        <p>学习中的疑问，工作里的灵感。</p>
        <div class="chat-prompts">
          <button class="prompt-button" type="button" data-prompt="请帮我制定一个 30 分钟的软件学习计划。"><i data-lucide="list-todo"></i>安排今天的学习计划<i data-lucide="arrow-up-right"></i></button>
          <button class="prompt-button" type="button" data-prompt="请用零基础能理解的方式解释 ROS 2 的 Node 和 Topic，并举一个例子。"><i data-lucide="code-2"></i>理解 ROS 2 的核心概念<i data-lucide="arrow-up-right"></i></button>
          <button class="prompt-button" type="button" data-prompt="请给我 5 个机器人相关的英语技术词汇，包括含义和例句。"><i data-lucide="languages"></i>练习技术英语<i data-lucide="arrow-up-right"></i></button>
        </div>
      </div>`;
  } else {
    elements.chatMessages.innerHTML = chatMessages
      .map(
        (message, index) => `
      <article class="chat-message ${message.role}" data-message-index="${index}">
        <div class="message-label">${message.role === "user" ? "你" : message.role === "error" ? "暂时没有连接上" : message.model === "codex" ? "Codex" : "DeepSeek"}${message.interrupted ? " · 回复未完成" : ""}</div>
        <div class="message-content ${message.role === "assistant" && !chatController ? "markdown" : ""}">${message.role === "assistant" && !chatController ? renderMarkdown(message.content) : escapeHtml(message.content)}</div>
        ${message.role === "assistant" ? `<button class="message-copy icon-button" type="button" data-copy-message="${index}" aria-label="复制回复" title="复制回复"><i data-lucide="copy"></i><span class="icon-fallback">复制</span></button>` : ""}
        ${!chatController && index === chatMessages.length - 1 && (message.role === "error" || message.interrupted || message.role === "user") ? '<button class="text-button retry-button" type="button" data-retry><i data-lucide="rotate-cw"></i>重新生成</button>' : ""}
      </article>`,
      )
      .join("");
    if (chatController) {
      elements.chatMessages.insertAdjacentHTML(
        "beforeend",
        '<div class="typing-indicator" aria-label="AI 正在思考"><span></span><span></span><span></span></div>',
      );
    }
  }
  refreshIcons();
  elements.chatMessages.scrollTop = follow
    ? elements.chatMessages.scrollHeight
    : oldScroll;
}

function renderMarkdown(content) {
  content = visibleAgentText(content);
  if (!window.marked || !window.DOMPurify) return escapeHtml(content);
  return window.DOMPurify.sanitize(
    window.marked.parse(content, { breaks: true, gfm: true }),
    {
      ALLOWED_TAGS: [
        "p",
        "br",
        "strong",
        "em",
        "del",
        "code",
        "pre",
        "blockquote",
        "ul",
        "ol",
        "li",
        "h1",
        "h2",
        "h3",
        "h4",
        "hr",
        "table",
        "thead",
        "tbody",
        "tr",
        "th",
        "td",
        "a",
      ],
      ALLOWED_ATTR: ["href", "title"],
    },
  );
}

function persistChat() {
  chatState.model = activeModel;
  chatState.conversations[activeModel] = chatMessages.slice(-100);
  chatState.drafts[activeModel] = elements.chatInput.value;
  try {
    localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(chatState));
  } catch {
    elements.chatStatus.textContent = "聊天记录无法保存，浏览器存储可能已满";
  }
}

function loadChatState() {
  const result = {
    model: "deepseek",
    conversations: { deepseek: [], codex: [] },
    drafts: { deepseek: "", codex: "" },
  };
  try {
    const saved = JSON.parse(localStorage.getItem(CHAT_STORAGE_KEY));
    if (["deepseek", "codex"].includes(saved?.model))
      result.model = saved.model;
    for (const model of ["deepseek", "codex"]) {
      if (Array.isArray(saved?.conversations?.[model])) {
        result.conversations[model] = saved.conversations[model]
          .filter(
            (message) =>
              message &&
              ["user", "assistant", "error"].includes(message.role) &&
              typeof message.content === "string",
          )
          .slice(-100)
          .map((message) => ({
            role: message.role,
            content: message.content.slice(0, 50000),
            model,
            interrupted: !!message.interrupted,
          }));
      }
      if (typeof saved?.drafts?.[model] === "string")
        result.drafts[model] = saved.drafts[model].slice(0, 4000);
    }
  } catch {
    /* A missing or damaged chat history must not affect tasks. */
  }
  return result;
}

function openTaskDialog(taskId = "") {
  elements.taskForm.reset();
  elements.taskForm.elements.date.value = today;
  elements.taskForm.elements.minutes.value = 30;
  elements.taskForm.elements.id.value = taskId;
  elements.dialogTitle.textContent = taskId ? "编辑任务" : "添加任务";

  if (taskId) {
    const task = state.tasks.find((item) => item.id === taskId);
    if (!task) return;
    elements.taskForm.elements.title.value = task.title;
    elements.taskForm.elements.category.value = task.category;
    elements.taskForm.elements.date.value = task.date;
    elements.taskForm.elements.minutes.value = task.minutes;
    elements.taskForm.elements.notes.value = task.notes;
    elements.taskForm.elements.progress.value = String(task.progress ?? 0);
  }

  elements.taskDialog.showModal();
  elements.taskForm.elements.title.focus();
}

function closeTaskDialog() {
  elements.taskDialog.close();
}

function saveTask(event) {
  event.preventDefault();
  const formData = new FormData(elements.taskForm);
  const id = formData.get("id");
  const taskData = {
    title: formData.get("title").trim(),
    category: formData.get("category"),
    date: formData.get("date"),
    minutes: Number(formData.get("minutes")),
    notes: formData.get("notes").trim(),
    progress: Number(formData.get("progress") || 0),
  };

  if (id) {
    const task = state.tasks.find((item) => item.id === id);
    Object.assign(task, taskData);
    if (task.progress < 100) {
      task.completed = false;
      task.verified = false;
    }
    showToast("任务已更新");
  } else {
    state.tasks.push({
      id: createId(),
      ...taskData,
      completed: false,
      verified: false,
      progress: Number(formData.get("progress") || 0),
      createdAt: new Date().toISOString(),
    });
    showToast("任务已添加");
  }

  persist();
  closeTaskDialog();
  render();
}

function handleTaskToggle(event) {
  if (!event.target.matches(".task-check")) return;
  const task = state.tasks.find((item) => item.id === event.target.dataset.id);
  if (!task) return;
  task.completed = event.target.checked;
  if (task.completed) task.progress = 100;
  else task.verified = false;
  const container = event.target.closest(".task-list, .plan-list");
  const shouldRestoreFocus = event.target === document.activeElement;
  persist();
  render();
  renderWorkspaceStats();
  if (shouldRestoreFocus) {
    [...container.querySelectorAll(".task-check")]
      .find((checkbox) => checkbox.dataset.id === task.id)?.focus({ preventScroll: true });
  }
  if (task.completed) {
    showToast("已标记完成，提交验收后获得经验");
    openVerifyDialog(task.id);
  } else {
    showToast("任务已恢复进行中");
  }
}

function handleTaskAction(event) {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const { action, id } = button.dataset;
  if (action === "complete") completeTaskFromButton(id);
  if (action === "verify") openVerifyDialog(id);
  if (action === "edit") openTaskDialog(id);
  if (action === "delete" && window.confirm("确定删除这个任务吗？")) {
    state.tasks = state.tasks.filter((item) => item.id !== id);
    persist();
    render();
    showToast("任务已删除");
  }
}

function completeTaskFromButton(id) {
  const task = state.tasks.find((item) => item.id === id);
  if (!task || task.completed) return;
  task.completed = true;
  task.progress = 100;
  persist();
  render();
  renderWorkspaceStats();
  showToast("已标记完成，提交验收后获得经验");
  openVerifyDialog(task.id);
}

let launcherDrag = null;
let launcherSuppressClick = false;
const LAUNCHER_POS_KEY = "career-life-launcher-pos";

function loadLauncherPosition() {
  try {
    const saved = JSON.parse(localStorage.getItem(LAUNCHER_POS_KEY));
    return saved && Number.isFinite(saved.left) && Number.isFinite(saved.top) ? saved : null;
  } catch {
    return null;
  }
}

function applyLauncherPosition(left, top) {
  const launcher = elements.chatLauncher;
  if (!launcher) return;
  const size = launcher.offsetWidth || 56;
  const maxX = Math.max(8, window.innerWidth - size - 8);
  const maxY = Math.max(8, window.innerHeight - size - 8);
  const x = Math.min(Math.max(8, left), maxX);
  const y = Math.min(Math.max(8, top), maxY);
  launcher.style.left = `${x}px`;
  launcher.style.top = `${y}px`;
  launcher.style.right = "auto";
  launcher.style.bottom = "auto";
}

function saveLauncherPosition() {
  const launcher = elements.chatLauncher;
  if (!launcher) return;
  localStorage.setItem(LAUNCHER_POS_KEY, JSON.stringify({ left: launcher.offsetLeft, top: launcher.offsetTop }));
}

function bindLauncherDrag() {
  const launcher = elements.chatLauncher;
  if (!launcher) return;
  const saved = loadLauncherPosition();
  if (saved) applyLauncherPosition(saved.left, saved.top);

  launcher.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const rect = launcher.getBoundingClientRect();
    launcherDrag = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      moved: false,
    };
    launcher.setPointerCapture(event.pointerId);
  });

  launcher.addEventListener("pointermove", (event) => {
    if (!launcherDrag || event.pointerId !== launcherDrag.pointerId) return;
    const dx = event.clientX - launcherDrag.startX;
    const dy = event.clientY - launcherDrag.startY;
    if (!launcherDrag.moved && Math.hypot(dx, dy) < 6) return;
    launcherDrag.moved = true;
    launcher.classList.add("is-dragging");
    applyLauncherPosition(event.clientX - launcherDrag.offsetX, event.clientY - launcherDrag.offsetY);
  });

  const endDrag = (event) => {
    if (!launcherDrag || event.pointerId !== launcherDrag.pointerId) return;
    const wasMoved = launcherDrag.moved;
    launcherDrag = null;
    launcher.classList.remove("is-dragging");
    if (wasMoved) {
      launcherSuppressClick = true;
      saveLauncherPosition();
      showToast("AI 助手位置已更新");
    }
  };
  launcher.addEventListener("pointerup", endDrag);
  launcher.addEventListener("pointercancel", endDrag);

  launcher.addEventListener("click", (event) => {
    if (!launcherSuppressClick) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    launcherSuppressClick = false;
  }, true);

  window.addEventListener("resize", () => {
    const position = loadLauncherPosition();
    if (position) applyLauncherPosition(position.left, position.top);
  });
}

function saveRecord(event) {
  event.preventDefault();
  const formData = new FormData(elements.recordForm);
  state.records.unshift({
    id: createId(),
    date: formData.get("date"),
    title: formData.get("title").trim(),
    details: formData.get("details").trim(),
    createdAt: new Date().toISOString(),
  });
  persist();
  elements.recordForm.reset();
  document.querySelector("#record-date").value = today;
  renderRecords();
  showToast("工作记录已保存");
}

function deleteRecord(event) {
  const button = event.target.closest("[data-record-id]");
  if (!button || !window.confirm("确定删除这条工作记录吗？")) return;
  state.records = state.records.filter(
    (item) => item.id !== button.dataset.recordId,
  );
  persist();
  renderRecords();
  showToast("记录已删除");
}

function render() {
  renderSummary();
  renderTodayTasks();
  renderPlans();
  renderRecords();
  renderWords();
  refreshIcons();
}

function renderSummary() {
  const tasks = state.tasks.filter((task) => task.date === today);
  const completed = tasks.filter((task) => task.completed);
  const studyMinutes = completed
    .filter((task) => task.category !== "work")
    .reduce((total, task) => total + task.minutes, 0);
  const percentage = tasks.length
    ? Math.round((completed.length / tasks.length) * 100)
    : 0;

  document.querySelector("#today-total").textContent = tasks.length;
  document.querySelector("#today-completed").textContent = completed.length;
  document.querySelector("#study-minutes").textContent = studyMinutes;
  document.querySelector("#nav-task-count").textContent =
    tasks.length - completed.length;
  document.querySelector("#completion-copy").textContent = tasks.length
    ? `还剩 ${tasks.length - completed.length} 项`
    : "先添加一个小任务";
  document.querySelector("#progress-value").textContent = `${percentage}%`;
  document.querySelector("#progress-bar").style.width = `${percentage}%`;
  const track = document.querySelector(".progress-track");
  track.setAttribute("aria-valuenow", percentage);
  const ring = document.querySelector("#today-progress-ring");
  ring.setAttribute("aria-valuenow", percentage);
  ring.setAttribute("aria-valuetext", `${tasks.length} 项任务中已完成 ${completed.length} 项`);
  ring.querySelector(".ring-value").style.strokeDashoffset = 100 - percentage;
  animateRingNumber(percentage);
  document.querySelector("#progress-caption").textContent = !tasks.length
    ? "从一个小任务开始，让今天有所收获。"
    : percentage === 100
      ? "今天的任务都完成了，为自己留一点休息时间。"
      : `已完成 ${completed.length} / ${tasks.length} 项，按自己的节奏继续。`;
  renderInsights();
}

function animateRingNumber(percentage) {
  window.cancelAnimationFrame(ringAnimation);
  const label = document.querySelector("#ring-value");
  const startValue = parseInt(label.textContent, 10) || 0;
  if (startValue === percentage || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
    label.textContent = `${percentage}%`;
    return;
  }
  let started;
  const tick = (time) => {
    started ??= time;
    const progress = Math.min((time - started) / 650, 1);
    const eased = 1 - (1 - progress) ** 3;
    label.textContent = `${Math.round(startValue + (percentage - startValue) * eased)}%`;
    if (progress < 1) ringAnimation = window.requestAnimationFrame(tick);
  };
  ringAnimation = window.requestAnimationFrame(tick);
}

function renderInsights() {
  const monday = new Date(`${today}T12:00:00`);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday);
    date.setDate(date.getDate() + index);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    const minutes = state.tasks
      .filter(
        (task) =>
          task.date === key && task.completed && task.category !== "work",
      )
      .reduce((total, task) => total + task.minutes, 0);
    return {
      key,
      minutes,
      label: ["一", "二", "三", "四", "五", "六", "日"][index],
    };
  });
  const maximum = Math.max(60, ...days.map((day) => day.minutes));
  document.querySelector("#week-minutes").textContent = days.reduce(
    (sum, day) => sum + day.minutes,
    0,
  );
  document.querySelector("#week-chart").innerHTML = days
    .map(
      (day) => `
    <button type="button" class="chart-day ${day.key === today ? "is-today" : ""}" data-week-day="${day.key}" aria-pressed="${day.key === selectedWeekDay}" aria-controls="week-day-list" ${day.key === today ? 'aria-current="date"' : ""} title="${day.key}：${day.minutes} 分钟" aria-label="周${day.label}，${day.minutes} 分钟，查看任务">
      <span class="day-label">${day.label}</span><span class="bar-track" aria-hidden="true"><span class="bar-fill" style="height:${(day.minutes / maximum) * 100}%"></span></span><span class="day-minutes">${day.minutes}</span>
    </button>`,
    )
    .join("");
  renderWeekDetails();
  const next = state.tasks.find(
    (task) => task.date === today && !task.completed,
  );
  document.querySelector("#next-task-title").textContent =
    next?.title ||
    (state.tasks.some((task) => task.date === today)
      ? "今天的任务已全部完成"
      : "今天还没有任务");
  document.querySelector("#next-task-meta").textContent = next
    ? `${categoryLabels[next.category]} · ${next.minutes} 分钟`
    : "留一点时间，整理今天的收获。";
}

function renderWeekDetails() {
  const tasks = state.tasks.filter((task) => task.date === selectedWeekDay);
  document.querySelector("#week-detail-title").textContent = selectedWeekDay === today
    ? "今天的安排"
    : `${formatDate(selectedWeekDay)}的安排`;
  document.querySelector("#week-day-total").textContent = `${tasks.length} 项任务`;
  document.querySelector("#week-day-list").innerHTML = tasks.length
    ? tasks.map((task) => `<article class="week-task ${task.completed ? "is-completed" : ""}">
        <span class="week-task-status" aria-label="${task.completed ? "已完成" : "未完成"}"><i data-lucide="${task.completed ? "circle-check" : "circle"}" aria-hidden="true"></i></span>
        <div><strong>${escapeHtml(task.title)}</strong><span>${categoryLabels[task.category]} · ${task.minutes} 分钟</span></div>
        <button class="icon-button" type="button" data-action="edit" data-id="${task.id}" aria-label="编辑${escapeHtml(task.title)}" title="编辑任务"><i data-lucide="pencil" aria-hidden="true"></i></button>
      </article>`).join("")
    : '<p class="week-empty">这一天还没有安排，留些空间给自己。</p>';
  refreshIcons();
}

function renderTodayTasks() {
  let tasks = state.tasks.filter((task) => task.date === today);
  if (activeFilter !== "all")
    tasks = tasks.filter((task) => task.category === activeFilter);
  tasks.sort((a, b) => Number(a.completed) - Number(b.completed));

  elements.todayTaskList.innerHTML = tasks.length
    ? tasks.map(taskTemplate).join("")
    : emptyTemplate(
        activeFilter === "all"
          ? "今天还没有任务，点击添加开始安排。"
          : "今天还没有这个分类的任务",
      );
  refreshIcons();
}

function renderPlans() {
  renderPlanList("software", elements.softwarePlanList);
  renderPlanList("english", elements.englishPlanList);
}

function renderPlanList(category, container) {
  const tasks = state.tasks
    .filter((task) => task.category === category)
    .sort((a, b) => a.date.localeCompare(b.date));
  container.innerHTML = tasks.length
    ? tasks.map(planTemplate).join("")
    : emptyTemplate(`还没有${categoryLabels[category]}学习任务`);
  refreshIcons();
}

function renderRecords() {
  const records = [...state.records].sort((a, b) =>
    b.date.localeCompare(a.date),
  );
  document.querySelector("#record-count").textContent = `${records.length} 条`;
  elements.recordList.innerHTML = records.length
    ? records.map(recordTemplate).join("")
    : emptyTemplate("还没有工作记录，写下今天解决的第一个问题");
  refreshIcons();
}

function taskTemplate(task) {
  return `
    <article class="task-item ${task.completed ? "is-completed" : ""}" data-category="${task.category}">
      ${taskCheckboxTemplate(task)}
      <div class="task-copy">
        <strong>${escapeHtml(task.title)}</strong>
        ${task.notes ? `<p>${escapeHtml(task.notes)}</p>` : ""}
        ${taskProgressTemplate(task)}
      </div>
      <div class="task-meta">
        <span class="category-tag ${task.category}">${categoryLabels[task.category]}</span>
        <span>${task.minutes} 分钟</span>
        ${taskVerifyBadgeTemplate(task)}
      </div>
      <div class="task-actions">
        ${!task.completed ? `<button class="complete-task-button" type="button" data-action="complete" data-id="${task.id}"><i data-lucide="check"></i>完成</button>` : ""}
        ${task.completed && !task.verified ? `<button class="verify-button" type="button" data-action="verify" data-id="${task.id}"><i data-lucide="badge-check"></i>验收</button>` : ""}
        <button class="icon-button" type="button" data-action="edit" data-id="${task.id}" aria-label="编辑任务" title="编辑任务">
          <i data-lucide="pencil"></i>
          <span class="icon-fallback">编辑</span>
        </button>
        <button class="icon-button delete-button" type="button" data-action="delete" data-id="${task.id}" aria-label="删除任务" title="删除任务">
          <i data-lucide="trash-2"></i>
          <span class="icon-fallback">删除</span>
        </button>
      </div>
    </article>`;
}

function planTemplate(task) {
  return `
    <article class="plan-item ${task.completed ? "is-completed" : ""}">
      ${taskCheckboxTemplate(task)}
      <div>
        <time datetime="${task.date}">${formatDate(task.date)}</time>
        <strong>${escapeHtml(task.title)}</strong>
        <p>${escapeHtml(task.notes || `${task.minutes} 分钟学习任务`)}</p>
        ${taskProgressTemplate(task)}
      </div>
      <div class="task-actions">
        ${!task.completed ? `<button class="complete-task-button" type="button" data-action="complete" data-id="${task.id}"><i data-lucide="check"></i>完成</button>` : ""}
        ${task.completed && !task.verified ? `<button class="verify-button" type="button" data-action="verify" data-id="${task.id}"><i data-lucide="badge-check"></i>验收</button>` : ""}
      </div>
      ${taskVerifyBadgeTemplate(task)}
      <button class="icon-button" type="button" data-action="edit" data-id="${task.id}" aria-label="编辑任务" title="编辑任务">
        <i data-lucide="pencil"></i>
        <span class="icon-fallback">编辑</span>
      </button>
    </article>`;
}

function taskCheckboxTemplate(task) {
  return `<label class="task-checkbox"><input class="task-check" type="checkbox" data-id="${task.id}"
    aria-label="${escapeHtml(task.title)}，标记为${task.completed ? "未完成" : "完成"}" ${task.completed ? "checked" : ""}><span class="check-visual" aria-hidden="true"></span></label>`;
}

function taskProgressTemplate(task) {
  if (task.completed) return "";
  const progress = Number(task.progress) || 0;
  if (!progress) return "";
  return `<div class="task-progress"><div class="task-progress-bar"><div class="task-progress-fill" style="width:${progress}%"></div></div><span class="task-progress-text">${progress}%</span></div>`;
}

function taskVerifyBadgeTemplate(task) {
  if (!task.completed) return "";
  return task.verified
    ? '<span class="verify-badge passed">✓ 已验收</span>'
    : '<span class="verify-badge pending">待验收</span>';
}

function recordTemplate(record) {
  return `
    <article class="record-item">
      <time datetime="${record.date}">${formatDate(record.date)}</time>
      <h3>${escapeHtml(record.title)}</h3>
      <p>${escapeHtml(record.details)}</p>
      <button class="icon-button record-delete" type="button" data-record-id="${record.id}" aria-label="删除记录" title="删除记录">
        <i data-lucide="trash-2"></i>
        <span class="icon-fallback">删除</span>
      </button>
    </article>`;
}

function emptyTemplate(message) {
  return `
    <div class="empty-state">
      <i data-lucide="circle-dashed"></i>
      <p>${message}</p>
    </div>`;
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("is-visible");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(
    () => elements.toast.classList.remove("is-visible"),
    1800,
  );
}

function persist(scheduleSync = true) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  if (scheduleSync) scheduleCloudSync();
}

function loadState() {
  try {
    const currentData = localStorage.getItem(STORAGE_KEY);
    const legacyData = localStorage.getItem(LEGACY_STORAGE_KEY);
    const stored = JSON.parse(currentData || legacyData);
    if (stored?.tasks && stored?.records) {
      stored.words = Array.isArray(stored.words) ? stored.words : [];
      if (!currentData && legacyData) persistMigratedState(stored);
      return stored;
    }
  } catch (error) {
    console.warn("无法读取本地数据，将显示空列表。", error);
  }

  return {
    tasks: [],
    records: [],
    words: [],
  };
}

function persistMigratedState(stored) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
}

function getLocalDate(inputDate) {
  const date = inputDate ? new Date(inputDate) : new Date();
  const offset = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function createId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `item-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatDate(dateString) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "short",
    day: "numeric",
    weekday: "short",
  }).format(new Date(`${dateString}T12:00:00`));
}

function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = value;
  return div.innerHTML;
}

function refreshIcons() {
  if (window.lucide) {
    window.lucide.createIcons();
    document.documentElement.classList.add("icons-ready");
  }
}
