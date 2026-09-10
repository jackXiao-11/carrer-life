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
  document.querySelectorAll(".social-login a").forEach((link) => {
    link.addEventListener("click", async (event) => {
      event.preventDefault();
      if (elements.accountError) elements.accountError.textContent = "正在连接第三方登录…";
      try {
        const response = await fetch(link.href, { credentials: "same-origin", headers: { Accept: "application/json" } });
        if (response.status === 501) {
          const data = await response.json().catch(() => ({}));
          if (elements.accountError) elements.accountError.textContent = data.error || "第三方登录尚未配置，请先使用邮箱注册。";
          return;
        }
      } catch {
        // A configured OAuth provider may redirect outside the site; let navigation handle it.
      }
      window.location.assign(link.href);
    });
  });
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
  }[viewName];
  document.querySelector("#view-subtitle").textContent = {
    dashboard: "把时间留给重要的事。",
    plans: "软件能力与英语，一起向前。",
    records: "每一个解决的问题，都值得留下。",
  }[viewName];
  elements.addTaskButton.hidden = viewName === "records";
  if (window.location.hash !== `#${viewName}`) window.location.hash = viewName;
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
  return { tasks: mergeList(local?.tasks, remote?.tasks), records: mergeList(local?.records, remote?.records) };
}

function restoreView() {
  const view = window.location.hash.slice(1);
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
  };

  if (id) {
    const task = state.tasks.find((item) => item.id === id);
    Object.assign(task, taskData);
    showToast("任务已更新");
  } else {
    state.tasks.push({
      id: createId(),
      ...taskData,
      completed: false,
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
  const container = event.target.closest(".task-list, .plan-list");
  const shouldRestoreFocus = event.target === document.activeElement;
  persist();
  render();
  if (shouldRestoreFocus) {
    [...container.querySelectorAll(".task-check")]
      .find((checkbox) => checkbox.dataset.id === task.id)?.focus({ preventScroll: true });
  }
  showToast(task.completed ? "完成一小步" : "任务已恢复");
}

function handleTaskAction(event) {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const { action, id } = button.dataset;
  if (action === "edit") openTaskDialog(id);
  if (action === "delete" && window.confirm("确定删除这个任务吗？")) {
    state.tasks = state.tasks.filter((item) => item.id !== id);
    persist();
    render();
    showToast("任务已删除");
  }
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
      </div>
      <div class="task-meta">
        <span class="category-tag ${task.category}">${categoryLabels[task.category]}</span>
        <span>${task.minutes} 分钟</span>
      </div>
      <div class="task-actions">
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
      </div>
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
      if (!currentData && legacyData) persistMigratedState(stored);
      return stored;
    }
  } catch (error) {
    console.warn("无法读取本地数据，将显示空列表。", error);
  }

  return {
    tasks: [],
    records: [],
  };
}

function persistMigratedState(stored) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
}

function getLocalDate() {
  const date = new Date();
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
