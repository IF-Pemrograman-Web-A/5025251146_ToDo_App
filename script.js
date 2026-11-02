const dbName = "todoDb";
const storeName = "todos";
const themeKey = "theme";
const reminderTimers = new Map();
let db;
let defaultTodos = [];
let alertTimer;
let stream;
let photoData = "";

class DarkModeToggle {
  constructor(button, root = document.documentElement) {
    this.button = button;
    this.root = root;
    this.button.addEventListener("click", () => this.toggle());
    this.apply(localStorage.getItem(themeKey) === "dark");
  }

  apply(isDark) {
    this.root.classList.toggle("dark", isDark);
    this.button.setAttribute("aria-pressed", String(isDark));
    this.button.textContent = isDark ? "Light mode" : "Dark mode";
  }

  toggle() {
    const isDark = !this.root.classList.contains("dark");
    this.apply(isDark);
    localStorage.setItem(themeKey, isDark ? "dark" : "light");
  }
}

const list = document.getElementById("todo-list");
const emptyMsg = document.getElementById("empty");
const form = document.getElementById("todo-form");
const errorMsg = document.getElementById("error");
const alertBox = document.getElementById("alert");
const notifyButton = document.getElementById("notify-permission");
const startCameraButton = document.getElementById("start-camera");
const takePhotoButton = document.getElementById("take-photo");
const video = document.getElementById("camera-preview");
const canvas = document.getElementById("photo-canvas");

new DarkModeToggle(document.getElementById("theme-toggle"));

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(storeName, { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function saveTodo(todo) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    tx.objectStore(storeName).put(todo);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

function removeTodo(id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    tx.objectStore(storeName).delete(id);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

function loadTodos() {
  return new Promise((resolve, reject) => {
    const request = db.transaction(storeName).objectStore(storeName).getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function createId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function findTodo(id) {
  return defaultTodos.find((todo) => todo.id === id);
}

function showAlert() {
  alertBox.classList.add("show");
  clearTimeout(alertTimer);
  alertTimer = setTimeout(() => alertBox.classList.remove("show"), 2000);
}

function updateEmpty() {
  emptyMsg.hidden = list.children.length > 0;
}

function clearReminder(id) {
  clearTimeout(reminderTimers.get(id));
  reminderTimers.delete(id);
}

async function showReminder(id) {
  const todo = findTodo(id);
  if (!todo || todo.done || Notification.permission !== "granted") return;
  const registration = await navigator.serviceWorker.ready;
  registration.showNotification(todo.title, {
    body: todo.description || "Time to do this todo.",
    tag: todo.id,
  });
}

function scheduleReminder(todo) {
  clearReminder(todo.id);
  if (!todo.notifyAt || todo.done) return;
  const delay = new Date(todo.notifyAt).getTime() - Date.now();
  if (delay <= 0 || delay > 2147483647) return;
  reminderTimers.set(todo.id, setTimeout(() => showReminder(todo.id), delay));
}

async function completeTodo(id, li) {
  const todo = findTodo(id);
  if (!todo) return;
  todo.done = true;
  await saveTodo(todo);
  clearReminder(id);
  li.remove();
  updateEmpty();
  showAlert();
}

async function editTodo(id, changes) {
  const todo = findTodo(id);
  if (!todo) return null;
  Object.assign(todo, changes);
  await saveTodo(todo);
  return todo;
}

async function deleteTodo(id, li) {
  const index = defaultTodos.findIndex((todo) => todo.id === id);
  if (index === -1) return;
  defaultTodos.splice(index, 1);
  await removeTodo(id);
  clearReminder(id);
  li.remove();
  updateEmpty();
}

function createTodo({ id, title, description, deadline, photo }) {
  const li = document.createElement("li");
  li.className = "todo";

  const top = document.createElement("div");
  top.className = "todo-title";

  const h3 = document.createElement("h3");
  h3.textContent = title;
  const titleInput = document.createElement("input");
  titleInput.type = "text";
  titleInput.hidden = true;
  titleInput.setAttribute("aria-label", "Edit title");

  const actions = document.createElement("div");
  actions.className = "todo-actions";

  const check = document.createElement("input");
  check.type = "checkbox";
  check.setAttribute("aria-label", `Mark "${title}" as done`);
  check.addEventListener("change", () => {
    if (check.checked) completeTodo(id, li);
  });

  const editButton = document.createElement("button");
  editButton.type = "button";
  editButton.className = "small-btn";
  editButton.textContent = "Edit";
  editButton.setAttribute("aria-pressed", "false");

  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.className = "small-btn";
  deleteButton.textContent = "Delete";
  deleteButton.addEventListener("click", () => deleteTodo(id, li));

  actions.append(check, editButton, deleteButton);
  top.append(h3, titleInput, actions);

  const bottom = document.createElement("div");
  bottom.className = "todo-desc";

  const p = document.createElement("p");
  p.textContent = description || "No description.";
  const descInput = document.createElement("textarea");
  descInput.rows = 3;
  descInput.hidden = true;
  descInput.setAttribute("aria-label", "Edit description");

  const d = document.createElement("p");
  d.className = "deadline";
  d.textContent = deadline ? `Due ${deadline}` : "";
  d.hidden = !deadline;
  const deadlineInput = document.createElement("input");
  deadlineInput.type = "date";
  deadlineInput.hidden = true;
  deadlineInput.setAttribute("aria-label", "Edit due date");

  bottom.append(p, descInput, d, deadlineInput);

  if (photo) {
    const img = document.createElement("img");
    img.className = "todo-photo";
    img.src = photo;
    img.alt = `Photo for ${title}`;
    bottom.append(img);
  }

  function setEditing(isEditing) {
    h3.hidden = isEditing;
    titleInput.hidden = !isEditing;
    p.hidden = isEditing;
    descInput.hidden = !isEditing;
    deadlineInput.hidden = !isEditing;
    d.hidden = isEditing || !d.textContent;
    editButton.textContent = isEditing ? "Save" : "Edit";
    editButton.setAttribute("aria-pressed", String(isEditing));
  }

  editButton.addEventListener("click", async () => {
    const todo = findTodo(id);
    if (!todo) return;

    if (titleInput.hidden) {
      titleInput.value = todo.title;
      descInput.value = todo.description;
      deadlineInput.value = todo.deadline;
      setEditing(true);
      return;
    }

    const newTitle = titleInput.value.trim();
    if (!newTitle) {
      titleInput.focus();
      return;
    }

    const updated = await editTodo(id, {
      title: newTitle,
      description: descInput.value.trim(),
      deadline: deadlineInput.value,
    });
    h3.textContent = updated.title;
    p.textContent = updated.description || "No description.";
    d.textContent = updated.deadline ? `Due ${updated.deadline}` : "";
    check.setAttribute("aria-label", `Mark "${updated.title}" as done`);
    setEditing(false);
  });

  li.append(top, bottom);
  return li;
}

async function addTodo(data) {
  const todo = { id: createId(), done: false, ...data };
  defaultTodos.push(todo);
  await saveTodo(todo);
  list.append(createTodo(todo));
  scheduleReminder(todo);
  updateEmpty();
}

function stopCamera() {
  if (stream) stream.getTracks().forEach((track) => track.stop());
  stream = null;
  video.hidden = true;
  takePhotoButton.hidden = true;
}

startCameraButton.addEventListener("click", async () => {
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: true });
    video.srcObject = stream;
    video.hidden = false;
    takePhotoButton.hidden = false;
  } catch (error) {
    startCameraButton.textContent = "Camera unavailable";
  }
});

takePhotoButton.addEventListener("click", () => {
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
  photoData = canvas.toDataURL("image/jpeg", 0.7);
  canvas.hidden = false;
  stopCamera();
});

notifyButton.addEventListener("click", async () => {
  if (!("Notification" in window)) return;
  const result = await Notification.requestPermission();
  notifyButton.textContent = result === "granted" ? "Notifications on" : "Notifications blocked";
});

async function registerWorker() {
  if (!("serviceWorker" in navigator)) return;
  try {
    await navigator.serviceWorker.register("sw.js");
  } catch (error) {
    notifyButton.hidden = true;
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(form);
  const title = data.get("title").trim();

  if (!title) {
    errorMsg.hidden = false;
    return;
  }

  errorMsg.hidden = true;
  await addTodo({
    title,
    description: data.get("description").trim(),
    deadline: data.get("deadline"),
    notifyAt: data.get("notifyAt"),
    photo: photoData,
  });
  form.reset();
  photoData = "";
  canvas.hidden = true;
  stopCamera();
  document.getElementById("title").focus();
});

async function init() {
  db = await openDb();
  defaultTodos = await loadTodos();
  defaultTodos.filter((todo) => !todo.done).forEach((todo) => {
    list.append(createTodo(todo));
    scheduleReminder(todo);
  });
  updateEmpty();
  registerWorker();
  if ("Notification" in window && Notification.permission === "granted") {
    notifyButton.textContent = "Notifications on";
  }
}

init();
