class DarkModeToggle {
    constructor(button, root = document.documentElement) {
    this.button = button;
    this.root = root;
    this.button.addEventListener("click", () => this.toggle());
    }

    toggle() {
    const isDark = this.root.classList.toggle("dark");
    this.button.setAttribute("aria-pressed", String(isDark));
    this.button.textContent = isDark ? "Light mode" : "Dark mode";
    }
}

const list = document.getElementById("todo-list");
const emptyMsg = document.getElementById("empty");
const form = document.getElementById("todo-form");
const errorMsg = document.getElementById("error");
const alertBox = document.getElementById("alert");
let alertTimer;

new DarkModeToggle(document.getElementById("theme-toggle"));

function showAlert() {
    alertBox.classList.add("show");
    clearTimeout(alertTimer);
    alertTimer = setTimeout(() => alertBox.classList.remove("show"), 2000);
}

function updateEmpty() {
    emptyMsg.hidden = list.children.length > 0;
}

function createTodo({ title, description, deadline }) {
    const li = document.createElement("li");
    li.className = "todo";

    const top = document.createElement("div");
    top.className = "todo-title";

    const h3 = document.createElement("h3");
    h3.textContent = title;
    const check = document.createElement("input");
    check.type = "checkbox";
    check.setAttribute("aria-label", `Mark "${title}" as done`);
    check.addEventListener("change", () => {
    li.classList.toggle("done", check.checked);
    if (check.checked) showAlert();
});

top.append(h3, check);

const bottom = document.createElement("div");
bottom.className = "todo-desc";

const p = document.createElement("p");
p.textContent = description || "No description.";
bottom.append(p);

if (deadline) {
    const d = document.createElement("p");
    d.className = "deadline";
    d.textContent = `Due ${deadline}`;
    bottom.append(d);
}

li.append(top, bottom);
return li;
}

function addTodo(data) {
    list.append(createTodo(data));
    updateEmpty();
}

form.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const title = data.get("title").trim();

    if (!title) {
    errorMsg.hidden = false;
    return;
    }

    errorMsg.hidden = true;
    addTodo({
    title,
    description: data.get("description").trim(),
    deadline: data.get("deadline"),
    });
    form.reset();
    document.getElementById("title").focus();
});

defaultTodos.forEach(addTodo);
