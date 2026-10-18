(function () {
  "use strict";

  const SESSION_KEY = "mindchamps.attendance.session.v1";
  const root = document.getElementById("portal-root");
  const viewNames = {
    dashboard: "Dashboard",
    classes: "Classes",
    class: "Class details",
    "create-class": "Create class",
    attendance: "Attendance",
    reports: "Weekly reports",
    archives: "Archives",
    profile: "Personal information",
    staff: "Teacher accounts",
    students: "Student accounts",
    "student-schedule": "My Schedule"
  };

  function showModalAlert(message, callback) {
    const existing = document.getElementById("custom-modal-alert");
    if (existing) existing.remove();

    const overlay = document.createElement("div");
    overlay.id = "custom-modal-alert";
    overlay.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;z-index:99999;";

    const dialog = document.createElement("div");
    dialog.style.cssText = "background:#ffffff;border-radius:16px;width:90%;max-width:360px;box-shadow:0 10px 30px rgba(0,0,0,0.15);overflow:hidden;text-align:center;font-family:inherit;";

    const header = document.createElement("div");
    header.style.cssText = "background:#7a1013;padding:24px 16px;display:flex;align-items:center;justify-content:center;";
    header.innerHTML = '<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>';

    const body = document.createElement("div");
    body.style.cssText = "padding:24px 20px;";

    const text = document.createElement("p");
    text.style.cssText = "color:#333333;font-size:15px;margin:0 0 20px 0;line-height:1.5;font-weight:500;";
    text.textContent = message;

    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "OK";
    button.style.cssText = "background:#7a1013;color:#ffffff;border:none;border-radius:20px;padding:10px 32px;font-size:14px;font-weight:600;cursor:pointer;transition:background 0.2s, transform 0.1s;min-width:100px;";
    button.onmouseover = function() { button.style.background = "#5f0c0e"; };
    button.onmouseout = function() { button.style.background = "#7a1013"; };

    button.onclick = function () {
      overlay.remove();
      if (typeof callback === "function") callback();
    };

    body.appendChild(text);
    body.appendChild(button);
    dialog.appendChild(header);
    dialog.appendChild(body);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
    button.focus();
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (character) {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      }[character];
    });
  }

  async function loadData() {
    try {
      const response = await fetch("http://localhost:5000/api/data");
      if (!response.ok) {
        throw new Error("Failed to fetch data from database server.");
      }
      const data = await response.json();
      if (!Array.isArray(data.users)) {
        throw new Error("Saved account data is invalid. Please contact the site administrator.");
      }
      if (!Array.isArray(data.classes)) {
        throw new Error("Saved class data is invalid. Please contact the site administrator.");
      }
      return data;
    } catch (error) {
      if (error.message.includes("Saved account data") || error.message.includes("Saved class data")) {
        throw error;
      }
      throw new Error("Could not connect to the database server. Ensure your backend server is running.");
    }
  }

  async function saveData(data) {
    try {
      await fetch("http://localhost:5000/api/data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
    } catch (error) {
      console.error("Failed to save data to server:", error);
    }
  }

  function currentUser(data) {
    const id = localStorage.getItem(SESSION_KEY);
    return data.users.find(function (user) { return user.id === id; }) || null;
  }

  function id() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function go(view, parameters) {
    const query = new URLSearchParams(Object.assign({ view: view }, parameters || {}));
    window.location.href = "portal.html?" + query.toString();
  }

  function mondayOf(date) {
    const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const daysSinceMonday = (monday.getDay() + 6) % 7;
    monday.setDate(monday.getDate() - daysSinceMonday);
    return localDate(monday);
  }

  function localDate(date) {
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0")
    ].join("-");
  }

  function dateLabel(value) {
    if (!value) return "—";
    return new Date(value + "T12:00:00").toLocaleDateString(undefined, {
      month: "short", day: "numeric", year: "numeric"
    });
  }

  function classFor(data, classId) {
    return data.classes.find(function (item) { return item.id === classId; });
  }

  function visibleClasses(data, user) {
    return user.role === "admin"
      ? data.classes
      : data.classes.filter(function (item) { return item.teacherId === user.id; });
  }

  function statusBadge(status) {
    return '<span class="portal-status ' + (status === "Present" ? "is-present" : "is-absent") + '">' +
      escapeHtml(status) + "</span>";
  }

  const LIST_PAGE_SIZE = 6;

  function paginatedItems(items, view, pageUrl) {
    const params = new URLSearchParams(window.location.search);
    const pageCount = Math.max(1, Math.ceil(items.length / LIST_PAGE_SIZE));
    const requestedPage = Number.parseInt(params.get("page"), 10) || 1;
    const page = Math.min(Math.max(requestedPage, 1), pageCount);
    const start = (page - 1) * LIST_PAGE_SIZE;
    return {
      start: start,
      items: items.slice(start, start + LIST_PAGE_SIZE),
      controls: pageCount > 1
        ? paginationControls(view, page, pageCount, start + 1, Math.min(start + LIST_PAGE_SIZE, items.length), items.length, pageUrl)
        : ""
    };
  }

  function paginationControls(view, page, pageCount, firstItem, lastItem, totalItems, pageUrl) {
    function pageLink(targetPage, label, disabled) {
      const params = new URLSearchParams(window.location.search);
      params.set("view", view);
      if (targetPage === 1) params.delete("page");
      else params.set("page", String(targetPage));
      return '<a class="portal-page-button' + (disabled ? " is-disabled" : "") + '"' +
        (disabled ? ' aria-disabled="true"' : ' href="' + (pageUrl || "portal.html") + '?' + escapeHtml(params.toString()) + '"') +
        '>' + label + '</a>';
    }
    return '<nav class="portal-pagination" aria-label="List pages"><span class="portal-muted">Showing ' +
      firstItem + '–' + lastItem + ' of ' + totalItems + '</span><div>' +
      pageLink(page - 1, "Previous", page === 1) +
      '<span class="portal-page-count">Page ' + page + ' of ' + pageCount + '</span>' +
      pageLink(page + 1, "Next", page === pageCount) + '</div></nav>';
  }

  function setAttendanceRosterPage(requestedPage) {
    const rows = Array.from(root.querySelectorAll("[data-attendance-row]"));
    const pageCount = Math.max(1, Math.ceil(rows.length / LIST_PAGE_SIZE));
    const page = Math.min(Math.max(requestedPage, 1), pageCount);
    rows.forEach(function (row, index) {
      row.hidden = Math.floor(index / LIST_PAGE_SIZE) + 1 !== page;
    });
    const label = root.querySelector("[data-attendance-page-label]");
    const previous = root.querySelector('[data-attendance-page="previous"]');
    const next = root.querySelector('[data-attendance-page="next"]');
    const range = root.querySelector("[data-attendance-page-range]");
    if (label) label.textContent = "Page " + page + " of " + pageCount;
    if (range) {
      const first = rows.length ? (page - 1) * LIST_PAGE_SIZE + 1 : 0;
      range.textContent = "Showing " + first + "–" + Math.min(page * LIST_PAGE_SIZE, rows.length) +
        " of " + rows.length + " students";
    }
    if (previous) previous.disabled = page === 1;
    if (next) next.disabled = page === pageCount;
  }

  function renderShell(data, user, view, content) {
    const isStudent = user.role === "student";
    const pageUrl = isStudent ? "student.html" : "portal.html";
    const links = isStudent
      ? [["student-schedule", "My schedule"], ["profile", "My profile"]]
      : user.role === "admin"
        ? [
          ["dashboard", "Overview"],
          ["classes", "Classes"],
          ["staff", "Teacher accounts"],
          ["students", "Student accounts"],
          ["reports", "Reports"],
          ["archives", "Archives"],
          ["profile", "My profile"]
        ]
        : [
          ["dashboard", "Overview"],
          ["classes", "Classes"],
          ["attendance", "Attendance"],
          ["reports", "Reports"],
          ["archives", "Archives"],
          ["profile", "My profile"]
        ];

    const activeView = view === "class" ? "classes" : view;
    const initials = user.name.split(/\s+/).slice(0, 2).map(function (part) {
      return part.charAt(0);
    }).join("").toUpperCase();

    const showCreateClassBtn = (user.role === "admin" && view === "classes");

    root.innerHTML =
      '<header class="app-top portal-top"><nav class="app-nav" aria-label="Main navigation">' +
        '<a class="portal-wordmark" href="' + pageUrl + (isStudent ? "?view=student-schedule" : "?view=dashboard") + '" aria-label="MindChamps dashboard">' +
          '<span class="portal-wordmark-mind">M<span class="portal-wordmark-i">ı</span>nd</span><span class="portal-wordmark-champs">Champs</span>' +
        '</a><ul class="app-links">' +
          links.map(function (link) {
            return '<li><a href="' + pageUrl + '?view=' + link[0] + '"' +
              (activeView === link[0] ? ' class="is-active" aria-current="page"' : "") + ">" +
              escapeHtml(link[1]) + "</a></li>";
          }).join("") +
        '</ul><div class="portal-user"><span class="user-avatar">' + escapeHtml(initials) +
          '</span><span class="user-name">' + escapeHtml(user.name) + '</span>' +
          '<button type="button" class="portal-logout" data-action="logout">Log out</button></div>' +
      '</nav></header><main class="portal-main' +
      (view === "profile" ? " portal-main-profile" : view === "staff" ? " portal-main-staff" : view === "students" ? " portal-main-students" : "") +
      '"><div class="portal-heading"><div>' +
        '<p class="portal-eyebrow">' + (user.role === "admin" ? "ADMINISTRATOR" : isStudent ? "STUDENT" : "TEACHER") +
        '</p><h1>' + escapeHtml(viewNames[view] || "Class details") + '</h1></div>' +
        (showCreateClassBtn ? '<a class="portal-button" href="portal.html?view=create-class">+ Create class</a>' : "") +
      '</div>' + content + '</main>';
  }

  function renderStudentSchedule(data, user) {
    const classes = studentClasses(data, user);
    const page = paginatedItems(classes, "student-schedule", "student.html");
    const classList = classes.length
      ? '<div class="portal-table-wrap"><table class="portal-table">' +
        '<thead><tr><th>Class</th><th>Subject</th><th>Class schedule</th><th>Teacher assigned</th><th>Room</th></tr></thead><tbody>' +
        page.items.map(function (item) {
          const teacher = data.users.find(function (person) { return person.id === item.teacherId; });
          return '<tr><td>' + escapeHtml(item.name || "Class") + '</td><td>' +
            escapeHtml(item.subject || "Not set") + '</td><td>' +
            escapeHtml(item.schedule || "Schedule not set") + '</td><td>' +
            escapeHtml(teacher ? teacher.name : "Not assigned") + '</td><td>' +
            escapeHtml(item.room || "Room not set") + '</td></tr>';
        }).join("") + '</tbody></table></div>' + page.controls
      : '<div class="portal-empty student-schedule-empty"><strong>No classes linked yet</strong>' +
        '<p>Your teacher must add a class roster entry with the same name as your student account.</p></div>';

    const content =
      '<section class="portal-welcome student-welcome"><div><span class="portal-eyebrow">YOUR SCHOOL SCHEDULE</span>' +
        '<h2>Welcome back, ' + escapeHtml(user.name.trim().split(/\s+/)[0]) + '</h2>' +
        '<p>Student Number: <strong>' + escapeHtml(user.studentNumber || "STU-001") + '</strong></p></div></section>' +
      '<section class="portal-panel" aria-label="My class list">' +
        '<div class="portal-panel-heading"><div><h2>My class list</h2>' +
        '<p>Class, subject, schedule, assigned teacher, and room.</p></div></div>' +
        classList + '</section>';

    renderShell(data, user, "student-schedule", content);
  }

  function studentClasses(data, user) {
    const studentName = user.name.trim().toLocaleLowerCase();
    return data.classes.filter(function (item) {
      return Array.isArray(item.students) && item.students.some(function (student) {
        const name = typeof student === "string" ? student : student && student.name;
        return typeof name === "string" && name.trim().toLocaleLowerCase() === studentName;
      });
    });
  }

  function renderStudentProfile(data, user) {
    const classes = studentClasses(data, user);
    const gradeLevels = Array.from(new Set(classes.map(function (item) {
      return item.level;
    }).filter(Boolean)));
    const details = [
      ["Student name", user.name],
      ["Student number", user.studentNumber || "STU-001"],
      ["Grade / level", user.gradeLevel || user.level || gradeLevels.join(", ") || "Not provided"],
      ["Guardian name", user.guardianName || "Not provided"],
      ["Guardian contact number", user.guardianContactNumber || user.guardianContact || "Not provided"],
      ["Address", user.address || "Not provided"]
    ];

    const content = '<section class="portal-panel student-profile-card"><div class="portal-panel-heading"><div>' +
      '<h2>Personal details</h2><p>Your profile information.</p></div></div>' +
      '<dl class="student-profile-details">' + details.map(function (detail) {
        return '<div><dt>' + escapeHtml(detail[0]) + '</dt><dd>' + escapeHtml(detail[1]) + '</dd></div>';
      }).join("") + '</dl></section>';

    renderShell(data, user, "profile", content);
  }

  function renderDashboard(data, user) {
    const classes = visibleClasses(data, user);
    const page = paginatedItems(classes, "dashboard");
    const classIds = classes.map(function (item) { return item.id; });
    const records = data.records.filter(function (record) {
      return classIds.indexOf(record.classId) !== -1;
    });
    const today = localDate(new Date());
    const todayRecords = records.filter(function (record) { return record.date === today; });
    const todayEntries = todayRecords.reduce(function (all, record) {
      return all.concat(record.entries);
    }, []);
    const present = todayEntries.filter(function (entry) { return entry.status === "Present"; }).length;
    const absent = todayEntries.filter(function (entry) { return entry.status === "Absent"; }).length;
    const totalTeachers = data.users.filter(function (person) { return person.role === "teacher"; }).length;
    const totalStudents = data.users.filter(function (person) { return person.role === "student"; }).length;
    const summaryCards = user.role === "student"
      ? statCard("My classes", classes.length, "Active classes")
      : user.role === "admin"
        ? statCard("All classes", classes.length, "Currently active classes") +
          statCard("Total teachers account", totalTeachers, "Active teachers") +
          statCard("Total students accounts", totalStudents, "Enrolled students") +
          statCard("Archived reports", data.archives.filter(function (archive) {
            return user.role === "admin" || archive.ownerId === user.id;
          }).length, "Saved report snapshots")
        : statCard("My classes", classes.length, "Active classes") +
          statCard("Present today", present, dateLabel(today)) +
          statCard("Absent today", absent, "Across recorded attendance") +
          statCard("Archived reports", data.archives.filter(function (archive) {
            return user.role === "admin" || archive.ownerId === user.id;
          }).length, "Saved report snapshots");

    const createClassAction = user.role === "admin"
      ? '<a class="portal-button portal-button-light" href="portal.html?view=create-class">Create a class</a>'
      : "";
    const content =
      '<section class="portal-welcome"><div><span class="portal-eyebrow">YOUR ATTENDANCE WORKSPACE</span>' +
        '<h2>Welcome back, ' + escapeHtml(user.name.split(/\s+/)[0]) + '</h2>' +
        '<p>Manage your classes, record daily attendance, and keep weekly reports in one place.</p></div>' +
        createClassAction + '</section>' +
      '<section class="portal-stats" aria-label="Attendance summary">' +
        summaryCards +
      '</section><section class="portal-panel"><div class="portal-panel-heading"><div>' +
        '<h2>All classes</h2><p>Currently active classes.</p></div>' +
        '<a class="portal-text-link" href="portal.html?view=classes">View all</a></div>' +
        classTable(page.items, data, user) + page.controls + '</section>' +
      (user.role === "admin"
        ? '<p class="portal-notice">MongoDB Backend Connected: Data is stored securely in your database collections.</p>'
        : "");
    renderShell(data, user, "dashboard", content);
  }

  function statCard(title, value, caption) {
    return '<article class="portal-stat"><span>' + escapeHtml(title) + '</span><strong>' +
      escapeHtml(value) + '</strong><small>' + escapeHtml(caption) + "</small></article>";
  }

  function classTable(classes, data, user) {
    if (!classes.length) {
      return '<div class="portal-empty"><strong>No classes yet</strong><p>' +
        (user.role === "admin"
          ? 'Create a class and add its students to get started.'
          : 'A class will appear here once an administrator assigns one to you.') +
        '</p>' + (user.role === "admin"
          ? '<a class="portal-button" href="portal.html?view=create-class">Create your first class</a>'
          : "") + '</div>';
    }
    return '<div class="portal-table-wrap"><table class="portal-table"><thead><tr>' +
      '<th>Class</th><th>Students</th><th>Teacher</th><th>Subject</th><th>Room / schedule</th><th></th>' +
      '</tr></thead><tbody>' + classes.map(function (item) {
        const teacher = data.users.find(function (person) { return person.id === item.teacherId; });
        return '<tr><td><strong>' + escapeHtml(item.name) + '</strong><small>' +
          escapeHtml(item.level || "Class") + '</small></td><td>' + item.students.length +
          '</td><td>' + escapeHtml(teacher ? teacher.name : user.name) + '</td><td>' +
          escapeHtml(item.subject || "Not set") + '</td><td>' +
          escapeHtml([item.room, item.schedule].filter(Boolean).join(" · ") || "Not set") +
          '</td><td><a class="portal-text-link" href="portal.html?view=class&classId=' +
          encodeURIComponent(item.id) + '">Manage</a></td></tr>';
      }).join("") + "</tbody></table></div>";
  }

  function renderClasses(data, user) {
    const classes = visibleClasses(data, user);
    const page = paginatedItems(classes, "classes");
    renderShell(data, user, "classes",
      '<section class="portal-panel"><div class="portal-panel-heading"><div>' +
        '<h2>Class list</h2><p>Open a class to manage its roster or take attendance.</p></div></div>' +
        classTable(page.items, data, user) + page.controls + '</section>');
  }

  function renderCreateClass(data, user) {
    if (user.role !== "admin") {
      go("dashboard");
      return;
    }
    const teachers = data.users.filter(function (person) { return person.role === "teacher"; });
    const teacherField = '<label class="portal-field">Teacher<select name="teacherId" required>' +
      '<option value="">Choose a teacher</option>' + teachers.map(function (teacher) {
        return '<option value="' + escapeHtml(teacher.id) + '">' + escapeHtml(teacher.name) +
          " · " + escapeHtml(teacher.email) + "</option>";
      }).join("") + '</select></label>';
    const noTeacher = !teachers.length
      ? '<p class="portal-notice">Create a teacher account before assigning classes.</p>' : "";
    const dayOptions = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"].map(function (d) {
      return '<option value="' + escapeHtml(d) + '">' + escapeHtml(d) + '</option>';
    }).join("");
    const timeOptions = ["8:00 AM - 10:00 AM", "9:00 AM - 11:00 AM", "9:00 AM - 12:00 PM", "10:00 AM - 12:00 PM", "1:00 PM - 3:00 PM", "2:00 PM - 4:00 PM"].map(function (t) {
      return '<option value="' + escapeHtml(t) + '">' + escapeHtml(t) + '</option>';
    }).join("");

    const mindChampsSubjects = [
      "Fun with Language™",
      "The Love for Chinese Language™",
      "Inquiry Moments™",
      "Numeracy Strategies™",
      "Music for the Mind™",
      "NeuroMooves™",
      "Creativity & Theatrical Strategies™",
      "Gourmet Moments™"
    ].map(function (sub) {
      return '<option value="' + escapeHtml(sub) + '">' + escapeHtml(sub) + '</option>';
    }).join("");

    renderShell(data, user, "create-class",
      '<section class="portal-panel portal-form-panel"><h2>Class information</h2>' +
        '<p>Set up the class and schedule.</p>' + noTeacher +
        '<form class="portal-form" data-form="create-class">' +
          '<div class="portal-form-grid"><label class="portal-field">Class name<input name="name" required maxlength="80" placeholder="e.g. Sunflower Room"></label>' +
          '<label class="portal-field">Subject<select name="subject" required><option value="">Choose subject</option>' + mindChampsSubjects + '</select></label>' +
          '<label class="portal-field">Grade / level<select name="level" required><option value="">Choose a grade level</option>' +
          ["Playgroup", "Nursery", "Preschool 1", "Preschool 2", "Preschool 3", "Kindergarten 1", "Kindergarten 2"]
            .map(function (level) { return '<option value="' + escapeHtml(level) + '">' + escapeHtml(level) + '</option>'; }).join("") +
          '</select></label>' +
          '<label class="portal-field">Room<input name="room" maxlength="60" placeholder="e.g. Room 4"></label>' +
          '<label class="portal-field">Day of the week<select name="scheduleDays" required><option value="">Choose day</option>' + dayOptions + '</select></label>' +
          '<label class="portal-field">Time range<select name="scheduleTime" required><option value="">Choose time range</option>' + timeOptions + '</select></label>' +
          teacherField + '</div>' +
          '<div class="portal-form-actions"><a class="portal-button portal-button-muted" href="portal.html?view=classes">Cancel</a>' +
          '<button class="portal-button" type="submit"' + (!teachers.length ? " disabled" : "") +
          '>Save class</button></div></form></section>');
  }

  function renderClass(data, user) {
    const classId = new URLSearchParams(window.location.search).get("classId");
    const item = classFor(data, classId);
    if (!item || (user.role !== "admin" && item.teacherId !== user.id)) {
      renderShell(data, user, "classes", '<section class="portal-panel portal-empty"><strong>Class not found</strong>' +
        '<p>This class may have been removed or you may not have access to it.</p>' +
        '<a class="portal-button" href="portal.html?view=classes">Back to classes</a></section>');
      return;
    }
    const page = paginatedItems(item.students, "class");
    
    const roster = item.students.length
      ? '<div class="portal-table-wrap"><table class="portal-table"><thead><tr><th>Student Name</th><th>Student ID</th><th>Grade / Level</th><th>Email</th><th>Guardian Name</th><th>Guardian Contact Number</th><th>Address</th></tr></thead><tbody>' +
        page.items.map(function (studentEntry, index) {
          const studentObj = typeof studentEntry === "object" && studentEntry !== null ? data.users.find(function(u) { return u.id === studentEntry.id || u.name.toLowerCase() === (studentEntry.name || "").toLowerCase(); }) : null;
          const name = typeof studentEntry === "string" ? studentEntry : studentEntry.name;
          const grade = studentObj ? (studentObj.gradeLevel || studentObj.level || "—") : "—";
          const email = studentObj ? (studentObj.email || "—") : "—";
          const gName = studentObj ? (studentObj.guardianName || "—") : "—";
          const gContact = studentObj ? (studentObj.guardianContactNumber || studentObj.guardianContact || "—") : "—";
          const address = studentObj ? (studentObj.address || "—") : "—";
          const sNumber = studentObj && studentObj.studentNumber ? studentObj.studentNumber : ('STU-' + String(page.start + index + 1).padStart(3, "0"));
          return '<tr><td><strong>' + escapeHtml(name) + '</strong></td><td>' + escapeHtml(sNumber) + '</td><td>' + escapeHtml(grade) + '</td><td>' + escapeHtml(email) + '</td><td>' + escapeHtml(gName) + '</td><td>' + escapeHtml(gContact) + '</td><td>' + escapeHtml(address) + '</td></tr>';
        }).join("") + "</tbody></table></div>" + page.controls
      : '<p class="portal-empty">No students have been added yet.</p>';

    const existingStudents = data.users.filter(function (p) { 
      return p.role === "student" && (!item.level || (p.gradeLevel || p.level || "").toLowerCase() === item.level.toLowerCase()); 
    });
    const studentDropdownOptions = existingStudents.map(function (s) {
      return '<option value="' + escapeHtml(s.name) + '">' + escapeHtml(s.name) + ' (' + escapeHtml(s.gradeLevel || "No level") + ')</option>';
    }).join("");

    const takeAttendanceButton = (user.role === "teacher"
      ? '<a class="portal-button" href="portal.html?view=attendance&classId=' + encodeURIComponent(item.id) + '">Take attendance</a>'
      : "");

    const content = '<section class="portal-panel"><div class="portal-panel-heading"><div>' +
      '<h2>' + escapeHtml(item.name) + '</h2><p>' +
      escapeHtml([item.level, item.subject, item.room, item.schedule].filter(Boolean).join(" · ") || "Class details not set") +
      '</p></div>' + takeAttendanceButton + '</div>' + roster +
      '<div class="portal-filter-row" style="margin-top: 16px;"><label class="portal-field">Search students to filter dropdown<input type="search" id="class-student-filter" maxlength="50" placeholder="Type to filter students..." oninput="const q=this.value.toLowerCase();const sel=document.getElementById(\'student-select-dropdown\');Array.from(sel.options).forEach(opt=>{if(!opt.value)return;opt.hidden=!opt.text.toLowerCase().includes(q);});"></label></div>' +
      '<form class="portal-inline-form" data-form="add-student"><input type="hidden" name="classId" value="' +
      escapeHtml(item.id) + '"><label class="portal-field">Add student (' + escapeHtml(item.level || "matching level") + ')<select name="student" id="student-select-dropdown" required><option value="">Choose a student</option>' + studentDropdownOptions + '</select></label>' +
      '<button class="portal-button" type="submit">Add student</button></form></section>';
    renderShell(data, user, "class", content);
  }

  function renderAttendance(data, user) {
    if (user.role === "admin") {
      go("dashboard");
      return;
    }
    const classes = visibleClasses(data, user);
    const params = new URLSearchParams(window.location.search);
    const selectedId = params.get("classId") || (classes[0] && classes[0].id) || "";
    const selectedClass = classFor(data, selectedId);
    const date = params.get("date") || localDate(new Date());
    const record = data.records.find(function (item) {
      return item.classId === selectedId && item.date === date;
    });
    const options = classes.map(function (item) {
      return '<option value="' + escapeHtml(item.id) + '"' + (item.id === selectedId ? " selected" : "") +
        ">" + escapeHtml(item.name) + "</option>";
    }).join("");
    let roster;
    if (!classes.length) {
      roster = '<div class="portal-empty"><strong>Create a class before taking attendance</strong>' +
        (user.role === "admin" ? '<a class="portal-button" href="portal.html?view=create-class">Create a class</a>' : '') + '</div>';
    } else if (!selectedClass.students.length) {
      roster = '<div class="portal-empty">Add students to this class before taking attendance.</div>';
    } else {
      roster = '<form class="portal-form portal-attendance-form" data-form="attendance"><input type="hidden" name="classId" value="' +
        escapeHtml(selectedId) + '"><input type="hidden" name="date" value="' + escapeHtml(date) + '">' +
        '<div class="portal-attendance-actions"><span class="portal-muted">' +
        (record ? "Saved record · last updated " + new Date(record.updatedAt).toLocaleString() : "Select a status for every student.") +
        '</span><button class="portal-button" type="submit">Save attendance</button></div>' +
        '<div class="portal-table-wrap"><table class="portal-table"><thead><tr><th>Student</th><th>Attendance status</th></tr></thead><tbody>' +
        selectedClass.students.map(function (studentEntry) {
          const studentName = typeof studentEntry === "string" ? studentEntry : studentEntry.name;
          const studentIdKey = typeof studentEntry === "object" && studentEntry !== null ? studentEntry.id : studentName;
          const saved = record && record.entries.find(function (entry) { return entry.studentId === studentIdKey || entry.name === studentName; });
          const status = saved ? saved.status : "";
          return '<tr data-attendance-row><td><strong>' + escapeHtml(studentName) + '</strong></td><td><select name="status-' +
            escapeHtml(studentIdKey) + '" required aria-label="Attendance for ' + escapeHtml(studentName) + '">' +
            '<option value=""' + (!status ? " selected" : "") + '>Choose status</option>' +
            '<option value="Present"' + (status === "Present" ? " selected" : "") + '>Present</option>' +
            '<option value="Absent"' + (status === "Absent" ? " selected" : "") + '>Absent</option></select></td></tr>';
        }).join("") + '</tbody></table></div>' +
        (selectedClass.students.length > LIST_PAGE_SIZE
          ? '<nav class="portal-pagination" aria-label="Attendance roster pages"><span class="portal-muted" data-attendance-page-range></span><div>' +
            '<button type="button" class="portal-page-button" data-attendance-page="previous" disabled>Previous</button>' +
            '<span class="portal-page-count" data-attendance-page-label>Page 1 of ' +
            Math.ceil(selectedClass.students.length / LIST_PAGE_SIZE) + '</span>' +
            '<button type="button" class="portal-page-button" data-attendance-page="next">Next</button></div></nav>'
          : "") + '</form>';
    }
    renderShell(data, user, "attendance",
      '<section class="portal-panel"><div class="portal-filter-row"><label class="portal-field">Class<select id="attendance-class">' +
      '<option value="">Choose a class</option>' + options + '</select></label><label class="portal-field">Date<input id="attendance-date" type="date" value="' +
      escapeHtml(date) + '"></label></div><h2 class="portal-section-heading">' +
      (selectedClass ? escapeHtml(selectedClass.name) : "Attendance roster") + " · " + dateLabel(date) +
      '</h2>' + roster + '</section>');
    if (selectedClass && selectedClass.students.length > LIST_PAGE_SIZE) setAttendanceRosterPage(1);
  }

  function recordsForWeek(data, user, startDate, selectedClassId) {
    const end = new Date(startDate + "T12:00:00");
    end.setDate(end.getDate() + 6);
    const endDate = localDate(end);
    let allowed = visibleClasses(data, user).map(function (item) { return item.id; });
    if (selectedClassId) {
      allowed = allowed.filter(function (id) { return id === selectedClassId; });
    }
    return {
      start: startDate,
      end: endDate,
      records: data.records.filter(function (record) {
        return allowed.indexOf(record.classId) !== -1 && record.date >= startDate && record.date <= endDate;
      }).sort(function (a, b) { return a.date.localeCompare(b.date); })
    };
  }

  function reportRows(data, records) {
    return records.reduce(function (rows, record) {
      const item = classFor(data, record.classId);
      return rows.concat(record.entries.map(function (entry) {
        return {
          date: record.date,
          className: item ? item.name : "Class",
          student: entry.name,
          status: entry.status
        };
      }));
    }, []);
  }

  function reportSummary(data, records) {
    const rows = reportRows(data, records);
    const present = rows.filter(function (row) { return row.status === "Present"; }).length;
    const absent = rows.length - present;
    return { rows: rows, present: present, absent: absent };
  }

  function reportTable(rows, query) {
    const normalizedQuery = String(query || "").trim().toLocaleLowerCase();
    const filteredRows = normalizedQuery
      ? rows.filter(function (row) {
        return [row.date, dateLabel(row.date), row.className, row.student, row.status]
          .some(function (value) {
            return String(value).toLocaleLowerCase().includes(normalizedQuery);
          });
      })
      : rows;
    if (!filteredRows.length) {
      return '<div class="portal-empty"><strong>' +
        (normalizedQuery ? "No matching attendance records" : "No attendance saved for this week") +
        '</strong>' +
        (normalizedQuery
          ? '<p>No weekly attendance records match your search.</p>'
          : '<p>Record attendance for a class first. The report will include all saved records in the selected week.</p>') +
        '</div>';
    }
    const page = paginatedItems(filteredRows, "reports");
    return '<div class="portal-table-wrap"><table class="portal-table"><thead><tr>' +
      '<th>Date</th><th>Class</th><th>Student</th><th>Status</th></tr></thead><tbody>' +
      page.items.map(function (row) {
        return "<tr><td>" + dateLabel(row.date) + "</td><td>" + escapeHtml(row.className) +
          "</td><td>" + escapeHtml(row.student) + "</td><td>" + statusBadge(row.status) + "</td></tr>";
      }).join("") + "</tbody></table></div>" + page.controls;
  }

  function renderReports(data, user) {
    const params = new URLSearchParams(window.location.search);
    const requestedStart = params.get("weekStart") || mondayOf(new Date());
    const startDate = mondayOf(new Date(requestedStart + "T12:00:00"));
    const selectedClassId = params.get("classId") || "";
    const searchQuery = params.get("search") || "";
    const report = recordsForWeek(data, user, startDate, selectedClassId);
    const summary = reportSummary(data, report.records);
    const classes = visibleClasses(data, user);

    const classOptions = '<option value="">All classes</option>' + classes.map(function (c) {
      return '<option value="' + escapeHtml(c.id) + '"' + (c.id === selectedClassId ? " selected" : "") + '>' + escapeHtml(c.name) + '</option>';
    }).join("");

    const reportActions = '<button type="button" class="portal-button portal-button-muted" data-action="print">Save as PDF</button>' +
      (user.role === "admin" ? "" : '<button type="button" class="portal-button" data-action="archive" data-start="' +
      escapeHtml(report.start) + '" data-end="' + escapeHtml(report.end) + '" data-class-id="' + escapeHtml(selectedClassId) + '">Archive report</button>');

    const content = '<section class="portal-panel"><div class="portal-stats portal-report-stats">' +
      statCard("Attendance entries", summary.rows.length, "Students recorded") +
      statCard("Present", summary.present, "Attendance records") +
      statCard("Absent", summary.absent, "Attendance records") +
      '</div><div class="portal-filter-row portal-report-filter">' +
      '<label class="portal-field">Class<select id="report-class">' + classOptions + '</select></label>' +
      '<label class="portal-field">Week starting (Monday)<input id="report-week" type="date" value="' +
      escapeHtml(startDate) + '"></label><form id="report-search-form" class="portal-report-search" role="search">' +
      '<input class="portal-report-search-input" type="search" name="search" value="' + escapeHtml(searchQuery) +
      '" placeholder="Search attendance records" maxlength="50" aria-label="Search weekly attendance report">' +
      '<button type="submit" class="portal-button portal-button-muted">Search</button></form></div>' +
      '<div class="portal-panel-heading portal-report-heading"><div><h2>Weekly attendance report</h2>' +
      '<p>Save a PDF copy or a dated snapshot in Archives.</p></div><div class="portal-actions portal-report-actions">' +
      reportActions + '</div></div>' +
      reportTable(summary.rows, searchQuery) + '</section>';
    renderShell(data, user, "reports", content);
  }

  function renderArchives(data, user) {
    const params = new URLSearchParams(window.location.search);
    const selectedClassId = params.get("classId") || "";

    const classes = visibleClasses(data, user);
    const classOptions = '<option value="">All classes</option>' + classes.map(function (c) {
      return '<option value="' + escapeHtml(c.id) + '"' + (c.id === selectedClassId ? " selected" : "") + '>' + escapeHtml(c.name) + '</option>';
    }).join("");

    let archives = data.archives;

    if (selectedClassId) {
      archives = archives.filter(function (archive) {
        return archive.classId === selectedClassId;
      });
    }

    archives.sort(function (a, b) {
      return b.createdAt.localeCompare(a.createdAt);
    });

    const page = paginatedItems(archives, "archives");
    const content = '<section class="portal-panel">' +
      '<div class="portal-filter-row" style="margin-bottom: 20px;">' +
      '<label class="portal-field">Filter Archive by Class<select id="archive-class">' + classOptions + '</select></label>' +
      '</div>' +
      '<div class="portal-panel-heading"><div>' +
      '<h2>Archived attendance reports</h2><p>Saved weekly snapshots created by teachers remain available for review.</p></div></div>' +
      (archives.length ? '<div class="portal-table-wrap"><table class="portal-table portal-archive-table"><thead><tr>' +
        '<th>Class</th><th>Report period</th><th>Archived</th><th>Entries</th><th>Present</th><th>Absent</th><th>Export</th>' +
        '</tr></thead><tbody>' + page.items.map(function (archive) {
          const rows = archive.rows || [];
          const present = rows.filter(function (row) { return row.status === "Present"; }).length;
          const targetClass = archive.classId ? classFor(data, archive.classId) : null;
          const className = targetClass ? targetClass.name : (archive.className || "All Classes");
          return '<tr><td><strong>' + escapeHtml(className) + '</strong></td><td><strong>' + dateLabel(archive.start) + " – " + dateLabel(archive.end) +
            '</strong></td><td>' + new Date(archive.createdAt).toLocaleString() + '</td><td>' + rows.length +
            '</td><td>' + present + '</td><td>' + (rows.length - present) +
            '</td><td><button type="button" class="portal-button portal-button-small portal-button-muted" data-action="print-archive" data-id="' +
            escapeHtml(archive.id) + '">Save as PDF</button></td></tr>';
        }).join("") + "</tbody></table></div>" + page.controls :
        '<div class="portal-empty"><strong>No archived reports found</strong><p>Teachers can archive weekly reports from the Reports page.</p></div>') +
      '<p class="portal-muted">PDF opens the browser print dialog; choose “Save as PDF”.</p></section>';
    renderShell(data, user, "archives", content);
  }

  function renderProfile(data, user) {
    renderShell(data, user, "profile",
      '<section class="portal-panel portal-form-panel"><div class="portal-security-note portal-security-first"><h2>Change password</h2>' +
      '<p>Choose a new password.</p>' +
      '<form class="portal-inline-form" data-form="change-password"><label class="portal-field">Current password<input name="currentPassword" type="password" required maxlength="32" placeholder="Enter current password" autocomplete="current-password"></label>' +
      '<label class="portal-field">New password<input name="newPassword" type="password" minlength="8" maxlength="32" required placeholder="Min. 8 characters" autocomplete="new-password"></label>' +
      '<button class="portal-button portal-button-muted" type="submit">Change password</button></form></div>' +
      '<div class="portal-profile-details-form"><h2>Personal information</h2>' +
      '<p>Update the profile details connected to your account.</p><form class="portal-form" data-form="profile">' +
      '<div class="portal-form-grid"><label class="portal-field">Full name<input name="name" required maxlength="50" placeholder="e.g. Renee Galang" value="' +
      escapeHtml(user.name) + '"></label><label class="portal-field">Email address<input name="email" type="email" required maxlength="100" placeholder="e.g. user@mindchamps.local" value="' +
      escapeHtml(user.email) + '"></label></div><div class="portal-form-actions">' +
      '<button class="portal-button" type="submit">Save personal information</button></div></form></div></section>');
  }

  function renderStaff(data, user) {
    if (user.role !== "admin") {
      go("dashboard");
      return;
    }
    const params = new URLSearchParams(window.location.search);
    const editTeacherId = params.get("editTeacherId");
    const teacherToEdit = editTeacherId ? data.users.find(function (p) { return p.id === editTeacherId && p.role === "teacher"; }) : null;

    const teachers = data.users.filter(function (person) { return person.role === "teacher"; });
    const page = paginatedItems(teachers, "staff");
    const table = teachers.length
      ? '<div class="portal-table-wrap"><table class="portal-table"><thead><tr><th>Teacher</th><th>Email</th><th>Classes</th><th>Created</th><th></th></tr></thead><tbody>' +
        page.items.map(function (teacher) {
          const count = data.classes.filter(function (item) { return item.teacherId === teacher.id; }).length;
          return '<tr><td><strong>' + escapeHtml(teacher.name) + '</strong></td><td>' +
            escapeHtml(teacher.email) + '</td><td>' + count + '</td><td>' +
            (teacher.createdAt ? dateLabel(teacher.createdAt.slice(0, 10)) : "—") +
            '</td><td><a class="portal-text-link" href="portal.html?view=staff&editTeacherId=' +
            encodeURIComponent(teacher.id) + '">Manage</a></td></tr>';
        }).join("") + "</tbody></table></div>" + page.controls
      : '<div class="portal-empty">No teacher accounts have been created.</div>';

    let formCardHtml = '';
    if (teacherToEdit) {
      formCardHtml =
        '<section class="portal-panel portal-form-panel"><h2>Edit teacher account</h2>' +
        '<p>Update the details or password for ' + escapeHtml(teacherToEdit.name) + '.</p>' +
        '<form class="portal-form" data-form="edit-teacher">' +
        '<input type="hidden" name="teacherId" value="' + escapeHtml(teacherToEdit.id) + '">' +
        '<div class="portal-form-grid">' +
        '<label class="portal-field">Teacher full name<input name="name" required maxlength="50" placeholder="e.g. Anezka Tongol" value="' + escapeHtml(teacherToEdit.name) + '"></label>' +
        '<label class="portal-field">Email address<input name="email" type="email" required maxlength="100" placeholder="e.g. teacher@mindchamps.local" value="' + escapeHtml(teacherToEdit.email) + '"></label>' +
        '<label class="portal-field">New password (leave blank to keep current)<input name="password" type="password" minlength="8" maxlength="32" placeholder="Min. 8 characters" autocomplete="new-password"></label>' +
        '</div><div class="portal-form-actions"><a class="portal-button portal-button-muted" href="portal.html?view=staff">Cancel</a>' +
        '<button class="portal-button" type="submit">Save teacher account</button></div></form></section>';
    } else {
      formCardHtml =
        '<section class="portal-panel portal-form-panel"><h2>Create teacher account</h2>' +
        '<p>Teachers can sign in, manage their classes, record attendance, and export reports.</p>' +
        '<form class="portal-form" data-form="create-teacher"><div class="portal-form-grid portal-create-teacher-grid">' +
        '<label class="portal-field">Teacher full name<input name="name" required maxlength="50" placeholder="e.g. Anezka Tongol"></label>' +
        '<label class="portal-field">Email address<input name="email" type="email" required maxlength="100" placeholder="e.g. teacher@mindchamps.local"></label>' +
        '<label class="portal-field">Temporary password<input name="password" type="password" minlength="8" maxlength="32" required placeholder="Min. 8 characters" autocomplete="new-password"></label>' +
        '</div><div class="portal-form-actions"><button class="portal-button" type="submit">Create teacher account</button></div></form></section>';
    }

    renderShell(data, user, "staff",
      formCardHtml +
      '<section class="portal-panel"><div class="portal-panel-heading"><div><h2>Teacher accounts</h2>' +
      '<p>Use a unique email address ending in @mindchamps.local for each account.</p></div></div>' + table + '</section>');
  }

  function renderStudents(data, user) {
    if (user.role !== "admin") {
      go("dashboard");
      return;
    }
    const params = new URLSearchParams(window.location.search);
    const editStudentId = params.get("editStudentId");
    const studentToEdit = editStudentId ? data.users.find(function (p) { return p.id === editStudentId && p.role === "student"; }) : null;

    const students = data.users.filter(function (person) { return person.role === "student"; });
    const page = paginatedItems(students, "students");
    const gradeOptions = ["Playgroup", "Nursery", "Preschool 1", "Preschool 2", "Preschool 3", "Kindergarten 1", "Kindergarten 2"];

    const table = students.length
      ? '<div class="portal-table-wrap"><table class="portal-table"><thead><tr><th>Student Name</th><th>Student Number</th><th>Grade / Level</th><th>Email</th><th>Guardian Name</th><th>Guardian Contact Number</th><th>Address</th><th></th></tr></thead><tbody>' +
        page.items.map(function (student, idx) {
          const sNum = student.studentNumber || ('STU-' + String(page.start + idx + 1).padStart(3, "0"));
          return '<tr><td><strong>' + escapeHtml(student.name) + '</strong></td><td>' + escapeHtml(sNum) + '</td><td>' +
            escapeHtml(student.gradeLevel || student.level || "—") + '</td><td>' +
            escapeHtml(student.email) + '</td><td>' +
            escapeHtml(student.guardianName || "—") + '</td><td>' +
            escapeHtml(student.guardianContactNumber || student.guardianContact || "—") + '</td><td>' +
            escapeHtml(student.address || "—") + '</td><td><a class="portal-text-link" href="portal.html?view=students&editStudentId=' +
            encodeURIComponent(student.id) + '">Manage</a></td></tr>';
        }).join("") + "</tbody></table></div>" + page.controls
      : '<div class="portal-empty">No student accounts have been created.</div>';

    let formCardHtml = '';
    if (studentToEdit) {
      const selectedLevel = studentToEdit.gradeLevel || studentToEdit.level || "";
      formCardHtml =
        '<section class="portal-panel portal-form-panel"><h2>Edit student account</h2>' +
        '<p>Update details or profile information for ' + escapeHtml(studentToEdit.name) + '.</p>' +
        '<form class="portal-form" data-form="edit-student">' +
        '<input type="hidden" name="studentId" value="' + escapeHtml(studentToEdit.id) + '">' +
        '<div class="portal-form-grid">' +
        '<label class="portal-field">Student Name<input name="name" required maxlength="50" placeholder="e.g. Avery Santos" value="' + escapeHtml(studentToEdit.name) + '"></label>' +
        '<label class="portal-field">Student Number<input name="studentNumber" required maxlength="20" placeholder="STU-000" value="' + escapeHtml(studentToEdit.studentNumber || "") + '"></label>' +
        '<label class="portal-field">Email address<input name="email" type="email" required maxlength="100" placeholder="student@mindchamps.local" value="' + escapeHtml(studentToEdit.email) + '"></label>' +
        '<label class="portal-field">New password (leave blank to keep current)<input name="password" type="password" minlength="8" maxlength="32" placeholder="Min. 8 characters" autocomplete="new-password"></label>' +
        '<label class="portal-field">Grade / Level<select name="gradeLevel" required><option value="">Choose a grade level</option>' +
        gradeOptions.map(function (lvl) {
          return '<option value="' + escapeHtml(lvl) + '"' + (lvl === selectedLevel ? " selected" : "") + '>' + escapeHtml(lvl) + '</option>';
        }).join("") + '</select></label>' +
        '<label class="portal-field">Guardian Name<input name="guardianName" maxlength="50" placeholder="e.g. Maria Santos" value="' + escapeHtml(studentToEdit.guardianName || "") + '"></label>' +
        '<label class="portal-field">Guardian Contact Number<input name="guardianContactNumber" type="tel" inputmode="numeric" pattern="[0-9]*" maxlength="15" placeholder="e.g. 09123456789" oninput="this.value=this.value.replace(/[^0-9]/g,\'\')" value="' + escapeHtml(studentToEdit.guardianContactNumber || studentToEdit.guardianContact || "") + '"></label>' +
        '<label class="portal-field" style="grid-column: 1 / -1;">Address<input name="address" maxlength="120" placeholder="e.g. Pasay City" value="' + escapeHtml(studentToEdit.address || "") + '"></label>' +
        '</div><div class="portal-form-actions"><a class="portal-button portal-button-muted" href="portal.html?view=students">Cancel</a>' +
        '<button class="portal-button" type="submit">Save student account</button></div></form></section>';
    } else {
      formCardHtml =
        '<section class="portal-panel portal-form-panel"><h2>Create student account</h2>' +
        '<p>Students can sign in, view their schedule, and check their profile information.</p>' +
        '<form class="portal-form" data-form="create-student"><div class="portal-form-grid">' +
        '<label class="portal-field">Student Name<input name="name" required maxlength="50" placeholder="e.g. Avery Santos"></label>' +
        '<label class="portal-field">Student Number<input name="studentNumber" required maxlength="20" placeholder="STU-000"></label>' +
        '<label class="portal-field">Email address<input name="email" type="email" required maxlength="100" placeholder="student@mindchamps.local"></label>' +
        '<label class="portal-field">Temporary password<input name="password" type="password" minlength="8" maxlength="32" required placeholder="At least 8 characters" autocomplete="new-password"></label>' +
        '<label class="portal-field">Grade / Level<select name="gradeLevel" required><option value="">Choose a grade level</option>' +
        gradeOptions.map(function (lvl) {
          return '<option value="' + escapeHtml(lvl) + '">' + escapeHtml(lvl) + '</option>';
        }).join("") + '</select></label>' +
        '<label class="portal-field">Guardian Name<input name="guardianName" maxlength="50" placeholder="e.g. Maria Santos"></label>' +
        '<label class="portal-field">Guardian Contact Number<input name="guardianContactNumber" type="tel" inputmode="numeric" pattern="[0-9]*" maxlength="15" placeholder="e.g. 09123456789" oninput="this.value=this.value.replace(/[^0-9]/g,\'\')"></label>' +
        '<label class="portal-field" style="grid-column: 1 / -1;">Address<input name="address" maxlength="120" placeholder="e.g. Pasay City"></label>' +
        '</div><div class="portal-form-actions"><button class="portal-button" type="submit">Create student account</button></div></form></section>';
    }

    renderShell(data, user, "students",
      formCardHtml +
      '<section class="portal-panel"><div class="portal-panel-heading"><div><h2>Student accounts</h2>' +
      '<p>Use a unique email address ending in @mindchamps.local for each account.</p></div></div>' + table + '</section>');
  }

  function csvCell(value) {
    return '"' + String(value == null ? "" : value).replace(/"/g, '""') + '"';
  }

  function downloadCsv(fileName, rows) {
    const header = ["Date", "Class", "Student", "Status"];
    const content = [header].concat(rows.map(function (row) {
      return [row.date, row.className, row.student, row.status];
    })).map(function (row) {
      return row.map(csvCell).join(",");
    }).join("\r\n");
    const blob = new Blob(["\uFEFF" + content], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function activeReport(data, user) {
    const params = new URLSearchParams(window.location.search);
    const start = params.get("weekStart") || mondayOf(new Date());
    const selectedClassId = params.get("classId") || "";
    const report = recordsForWeek(data, user, start, selectedClassId);
    return { start: report.start, end: report.end, classId: selectedClassId, rows: reportRows(data, report.records) };
  }

  async function handleSubmit(event) {
    if (event.target.id === "report-search-form") {
      event.preventDefault();
      const weekStart = document.getElementById("report-week").value;
      const classId = document.getElementById("report-class").value;
      const search = String(new FormData(event.target).get("search") || "").trim();
      const parameters = { weekStart: weekStart };
      if (classId) parameters.classId = classId;
      if (search) parameters.search = search;
      go("reports", parameters);
      return;
    }
    const form = event.target.closest("form[data-form]");
    if (!form) return;
    event.preventDefault();
    const data = await loadData();
    const user = currentUser(data);
    if (!user) {
      window.location.href = "login.html";
      return;
    }
    const values = new FormData(form);
    const formType = form.dataset.form;

    if (formType === "create-teacher") {
      const email = String(values.get("email")).trim().toLowerCase();
      if (!email.endsWith("@mindchamps.local")) {
        showModalAlert("Email address must end with @mindchamps.local");
        return;
      }
      if (data.users.some(function (person) { return person.email.toLowerCase() === email; })) {
        showModalAlert("An account with that email already exists.");
        return;
      }
      data.users.push({
        id: id(), role: "teacher", name: String(values.get("name")).trim(),
        email: email, password: String(values.get("password")), createdAt: new Date().toISOString()
      });
      await saveData(data);
      showModalAlert("Teacher account created. Share the temporary password with the teacher securely.", function() {
        go("staff");
      });
      return;
    }

    if (formType === "edit-teacher") {
      const teacherId = String(values.get("teacherId"));
      const teacher = data.users.find(function (p) { return p.id === teacherId && p.role === "teacher"; });
      if (!teacher) {
        showModalAlert("Teacher account not found.");
        return;
      }
      const email = String(values.get("email")).trim().toLowerCase();
      if (!email.endsWith("@mindchamps.local")) {
        showModalAlert("Email address must end with @mindchamps.local");
        return;
      }
      if (data.users.some(function (person) { return person.id !== teacherId && person.email.toLowerCase() === email; })) {
        showModalAlert("An account with that email already exists.");
        return;
      }
      teacher.name = String(values.get("name")).trim();
      teacher.email = email;
      const newPassword = String(values.get("password") || "").trim();
      if (newPassword) {
        if (newPassword.length < 8) {
          showModalAlert("Choose a password with at least 8 characters.");
          return;
        }
        teacher.password = newPassword;
      }
      await saveData(data);
      showModalAlert("Teacher account updated successfully.", function() {
        go("staff");
      });
      return;
    }

    if (formType === "create-student") {
      const email = String(values.get("email")).trim().toLowerCase();
      if (!email.endsWith("@mindchamps.local")) {
        showModalAlert("Email address must end with @mindchamps.local");
        return;
      }
      if (data.users.some(function (person) { return person.email.toLowerCase() === email; })) {
        showModalAlert("An account with that email already exists.");
        return;
      }
      data.users.push({
        id: id(),
        role: "student",
        name: String(values.get("name")).trim(),
        studentNumber: String(values.get("studentNumber") || "").trim(),
        email: email,
        password: String(values.get("password")),
        gradeLevel: String(values.get("gradeLevel")).trim(),
        guardianName: String(values.get("guardianName") || "").trim(),
        guardianContactNumber: String(values.get("guardianContactNumber") || "").trim(),
        address: String(values.get("address") || "").trim(),
        createdAt: new Date().toISOString()
      });
      await saveData(data);
      showModalAlert("Student account created. Share the credentials with the student or parent.", function() {
        go("students");
      });
      return;
    }

    if (formType === "edit-student") {
      const studentId = String(values.get("studentId"));
      const student = data.users.find(function (p) { return p.id === studentId && p.role === "student"; });
      if (!student) {
        showModalAlert("Student account not found.");
        return;
      }
      const email = String(values.get("email")).trim().toLowerCase();
      if (!email.endsWith("@mindchamps.local")) {
        showModalAlert("Email address must end with @mindchamps.local");
        return;
      }
      if (data.users.some(function (person) { return person.id !== studentId && person.email.toLowerCase() === email; })) {
        showModalAlert("An account with that email already exists.");
        return;
      }
      student.name = String(values.get("name")).trim();
      student.studentNumber = String(values.get("studentNumber") || "").trim();
      student.email = email;
      student.gradeLevel = String(values.get("gradeLevel")).trim();
      student.guardianName = String(values.get("guardianName") || "").trim();
      student.guardianContactNumber = String(values.get("guardianContactNumber") || "").trim();
      student.address = String(values.get("address") || "").trim();

      const newPassword = String(values.get("password") || "").trim();
      if (newPassword) {
        if (newPassword.length < 8) {
          showModalAlert("Choose a password with at least 8 characters.");
          return;
        }
        student.password = newPassword;
      }
      await saveData(data);
      showModalAlert("Student account updated successfully.", function() {
        go("students");
      });
      return;
    }

    if (formType === "create-class") {
      if (user.role !== "admin") return;
      const teacherId = String(values.get("teacherId"));
      if (!data.users.some(function (person) { return person.id === teacherId && person.role === "teacher"; })) {
        showModalAlert("Select a valid teacher for this class.");
        return;
      }
      const days = String(values.get("scheduleDays") || "").trim();
      const time = String(values.get("scheduleTime") || "").trim();
      const scheduleString = [days, time].filter(Boolean).join(", ");

      data.classes.push({
        id: id(),
        name: String(values.get("name")).trim(),
        subject: String(values.get("subject") || "").trim(),
        level: String(values.get("level")).trim(),
        room: String(values.get("room")).trim(),
        schedule: scheduleString,
        teacherId: teacherId,
        students: [],
        createdAt: new Date().toISOString()
      });
      await saveData(data);
      go("classes");
      return;
    }

    if (formType === "add-student") {
      const item = classFor(data, String(values.get("classId")));
      if (!item || (user.role !== "admin" && item.teacherId !== user.id)) {
        showModalAlert("You do not have permission to update this class.");
        return;
      }
      const selectedStudentName = String(values.get("student") || "").trim();
      if (!selectedStudentName) {
        showModalAlert("Please select a student.");
        return;
      }
      if (item.students.some(function (st) {
        const n = typeof st === "string" ? st : st.name;
        return n.toLowerCase() === selectedStudentName.toLowerCase();
      })) {
        showModalAlert("Student is already in this class.");
        return;
      }
      const studentObj = data.users.find(function(u) { return u.role === "student" && u.name.toLowerCase() === selectedStudentName.toLowerCase(); });
      item.students.push({ id: studentObj ? studentObj.id : id(), name: selectedStudentName });
      await saveData(data);
      go("class", { classId: item.id });
      return;
    }

    if (formType === "attendance") {
      if (user.role === "admin") {
        showModalAlert("Administrators are not permitted to take attendance.");
        return;
      }
      const classId = String(values.get("classId"));
      const item = classFor(data, classId);
      if (!item || item.teacherId !== user.id) {
        showModalAlert("You do not have permission to update this attendance record.");
        return;
      }
      const date = String(values.get("date"));
      const entries = item.students.map(function (student) {
        const studentName = typeof student === "string" ? student : student.name;
        const studentIdKey = typeof student === "object" && student !== null ? student.id : studentName;
        return {
          studentId: studentIdKey,
          name: studentName,
          status: String(values.get("status-" + studentIdKey))
        };
      });
      if (entries.some(function (entry) { return entry.status !== "Present" && entry.status !== "Absent"; })) {
        showModalAlert("Choose Present or Absent for every student before saving.");
        return;
      }
      const existing = data.records.find(function (record) {
        return record.classId === classId && record.date === date;
      });
      const updated = {
        classId: classId, date: date, entries: entries, updatedAt: new Date().toISOString()
      };
      if (existing) Object.assign(existing, updated);
      else data.records.push(updated);
      await saveData(data);
      go("attendance", { classId: classId, date: date });
      return;
    }

    if (formType === "profile") {
      const email = String(values.get("email")).trim().toLowerCase();
      if (!email.endsWith("@mindchamps.local")) {
        showModalAlert("Email address must end with @mindchamps.local");
        return;
      }
      if (data.users.some(function (person) {
        return person.id !== user.id && person.email.toLowerCase() === email;
      })) {
        showModalAlert("That email address is already in use.");
        return;
      }
      user.name = String(values.get("name")).trim();
      user.email = email;
      await saveData(data);
      renderProfile(data, user);
      showModalAlert("Personal information saved.");
      return;
    }

    if (formType === "change-password") {
      const currentPassword = String(values.get("currentPassword"));
      const newPassword = String(values.get("newPassword"));
      if (currentPassword !== user.password) {
        showModalAlert("Current password is incorrect.");
        return;
      }
      if (newPassword.length < 8) {
        showModalAlert("Choose a password with at least 8 characters.");
        return;
      }
      user.password = newPassword;
      await saveData(data);
      form.reset();
      showModalAlert("Password changed.");
    }
  }

  async function handleClick(event) {
    const attendancePageButton = event.target.closest("[data-attendance-page]");
    if (attendancePageButton) {
      const currentLabel = root.querySelector("[data-attendance-page-label]");
      const currentPage = currentLabel ? Number(currentLabel.textContent.match(/\d+/)[0]) : 1;
      const offset = attendancePageButton.dataset.attendancePage === "next" ? 1 : -1;
      setAttendanceRosterPage(currentPage + offset);
      return;
    }
    const button = event.target.closest("[data-action]");
    if (!button) return;
    const action = button.dataset.action;
    if (action === "logout") {
      localStorage.removeItem(SESSION_KEY);
      window.location.href = "login.html";
      return;
    }
    if (action === "print") {
      window.print();
      return;
    }
    if (action === "archive") {
      const data = await loadData();
      const user = currentUser(data);
      if (!user || user.role === "admin") return;
      const report = activeReport(data, user);
      const targetClass = report.classId ? classFor(data, report.classId) : null;
      const className = targetClass ? targetClass.name : "All Classes";

      const exists = data.archives.some(function (item) {
        return item.start === report.start && item.end === report.end &&
          item.classId === report.classId &&
          item.ownerId === user.id;
      });
      if (exists) {
        showModalAlert("A report for this class and week has already been archived.");
        return;
      }
      data.archives.push({
        id: id(),
        ownerId: user.id,
        classId: report.classId || "",
        className: className,
        start: report.start,
        end: report.end,
        rows: report.rows,
        createdAt: new Date().toISOString()
      });
      await saveData(data);
      showModalAlert("Weekly attendance report archived.", function() {
        go("archives", report.classId ? { classId: report.classId } : {});
      });
      return;
    }
    if (action === "csv") {
      const data = await loadData();
      const user = currentUser(data);
      if (!user) return;
      if (button.dataset.source === "archive") {
        const archive = data.archives.find(function (item) { return item.id === button.dataset.id; });
        if (archive) downloadCsv("attendance-" + archive.start + "-to-" + archive.end + ".csv", archive.rows);
      } else {
        const report = activeReport(data, user);
        downloadCsv("weekly-attendance-" + report.start + "-to-" + report.end + ".csv", report.rows);
      }
      return;
    }
    if (action === "print-archive") {
      const data = await loadData();
      const archive = data.archives.find(function (item) { return item.id === button.dataset.id; });
      if (!archive) return;
      const rows = archive.rows.map(function (row) {
        return "<tr><td>" + dateLabel(row.date) + "</td><td>" + escapeHtml(row.className) +
          "</td><td>" + escapeHtml(row.student) + "</td><td>" + escapeHtml(row.status) + "</td></tr>";
      }).join("");
      const printWindow = window.open("", "_blank");
      if (!printWindow) {
        showModalAlert("Allow pop-ups to print this archived report.");
        return;
      }
      printWindow.document.write(
        '<!doctype html><html><head><title>Archived attendance report</title><style>' +
        'body{font:14px Arial,sans-serif;margin:32px;color:#222}h1{font-size:22px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccc;padding:8px;text-align:left}th{background:#eee}</style>' +
        '</head><body><h1>Weekly attendance report</h1><p>' + dateLabel(archive.start) + " – " +
        dateLabel(archive.end) + '</p><p>Archived ' + new Date(archive.createdAt).toLocaleString() +
        '</p><table><thead><tr><th>Date</th><th>Class</th><th>Student</th><th>Status</th></tr></thead><tbody>' +
        rows + '</tbody></table><script>window.onload=function(){window.print()}<\/script></body></html>'
      );
      printWindow.document.close();
      return;
    }
  }

  function handleFilterChange(event) {
    if (event.target.id === "attendance-class" || event.target.id === "attendance-date") {
      const classId = document.getElementById("attendance-class").value;
      const date = document.getElementById("attendance-date").value;
      if (classId && date) go("attendance", { classId: classId, date: date });
    }

    if (event.target.id === "report-week" || event.target.id === "report-class") {
      const weekVal = document.getElementById("report-week").value;
      const classIdVal = document.getElementById("report-class").value;
      const params = {};
      if (weekVal) params.weekStart = mondayOf(new Date(weekVal + "T12:00:00"));
      if (classIdVal) params.classId = classIdVal;
      go("reports", params);
    }

    if (event.target.id === "archive-class") {
      const classIdVal = event.target.value;
      const params = {};
      if (classIdVal) params.classId = classIdVal;
      go("archives", params);
    }
  }

  function handleStudentSearchInput(event) {
    if (event.target.id !== "existing-student-search") return;
    const query = event.target.value.trim().toLocaleLowerCase();
    root.querySelectorAll("[data-student-search-row]").forEach(function (row) {
      row.hidden = !row.textContent.toLocaleLowerCase().includes(query);
    });
  }

  function renderLogin() {
    document.querySelectorAll("[data-password-toggle]").forEach(function (button) {
      button.addEventListener("click", function () {
        const passwordInput = document.getElementById(button.getAttribute("data-password-toggle"));
        if (!passwordInput) return;
        const isVisible = passwordInput.type === "text";
        passwordInput.type = isVisible ? "password" : "text";
        button.textContent = isVisible ? "Show" : "Hide";
        button.setAttribute("aria-label", isVisible ? "Show password" : "Hide password");
        button.setAttribute("aria-pressed", String(!isVisible));
      });
    });

    const form = document.getElementById("login-form");
    if (form) {
      const emailInput = document.getElementById("email");
      const passwordInput = document.getElementById("pw");
      if (emailInput) {
        emailInput.setAttribute("maxlength", "100");
        emailInput.setAttribute("placeholder", "e.g. admin@mindchamps.local");
      }
      if (passwordInput) {
        passwordInput.setAttribute("maxlength", "32");
        passwordInput.setAttribute("placeholder", "Enter password");
      }

      form.addEventListener("submit", async function (event) {
        event.preventDefault();
        let data;
        try {
          data = await loadData();
        } catch (error) {
          document.getElementById("login-message").textContent = error.message;
          return;
        }
        const values = new FormData(form);
        const email = String(values.get("email")).trim().toLowerCase();
        const password = String(values.get("password"));
        const role = String(values.get("role"));
        if (!email.endsWith("@mindchamps.local")) {
          document.getElementById("login-message").textContent = "Email address must end with @mindchamps.local";
          return;
        }
        const user = data.users.find(function (person) {
          return person.email.toLowerCase() === email && person.password === password && person.role === role;
        });
        if (!user) {
          document.getElementById("login-message").textContent = "Email, password, or account type is incorrect.";
          return;
        }
        localStorage.setItem(SESSION_KEY, user.id);
        if (user.role === "student") {
          window.location.href = "student.html";
        } else {
          go("dashboard");
        }
      });
    }

    const restoreStudentLogin = document.getElementById("restore-student-login");
    if (restoreStudentLogin) {
      restoreStudentLogin.addEventListener("click", function () {
        const message = document.getElementById("login-message");
        message.textContent = "Default student account has been removed. Please create student accounts via the admin panel.";
      });
    }

    const restoreDemoLogin = document.getElementById("restore-demo-login");
    if (restoreDemoLogin) {
      restoreDemoLogin.addEventListener("click", async function () {
        const message = document.getElementById("login-message");
        let data;
        try {
          data = await loadData();
          if (!Array.isArray(data.users)) {
            throw new Error("Saved account data is invalid. Please contact the site administrator.");
          }
          let admin = data.users.find(function (person) {
            return person.email && person.email.toLowerCase() === "admin@mindchamps.local";
          });
          if (admin) {
            admin.role = "admin";
          } else {
            admin = {
              id: id(),
              role: "admin",
              name: "School Administrator",
              email: "admin@mindchamps.local"
            };
            data.users.push(admin);
          }
          admin.password = "Admin123!";
          await saveData(data);
          document.getElementById("role").value = "admin";
          document.getElementById("email").value = admin.email;
          document.getElementById("pw").value = admin.password;
          message.textContent = "Demo admin login restored. You can now log in.";
        } catch (error) {
          message.textContent = error.message || "Could not restore the demo login.";
        }
      });
    }

    const resetLink = document.getElementById("show-reset");
    const resetForm = document.getElementById("reset-form");
    const loginView = document.getElementById("login-view");
    const cancelReset = document.getElementById("cancel-reset");
    if (resetLink && resetForm && loginView && cancelReset) {
      function closeReset() {
        resetForm.hidden = true;
        loginView.hidden = false;
        document.body.classList.remove("is-resetting");
      }

      resetLink.addEventListener("click", function (event) {
        event.preventDefault();
        document.getElementById("reset-message").textContent = "";
        loginView.hidden = true;
        resetForm.hidden = false;
        document.body.classList.add("is-resetting");
        const resetEmailInput = document.getElementById("reset-email");
        const resetPwInput = document.getElementById("reset-pw");
        if (resetEmailInput) {
          resetEmailInput.setAttribute("maxlength", "100");
          resetEmailInput.setAttribute("placeholder", "e.g. user@mindchamps.local");
        }
        if (resetPwInput) {
          resetPwInput.setAttribute("maxlength", "32");
          resetPwInput.setAttribute("placeholder", "Min. 8 characters");
        }
        if (resetEmailInput) resetEmailInput.focus();
      });
      cancelReset.addEventListener("click", function () {
        resetForm.reset();
        closeReset();
        resetLink.focus();
      });
      resetForm.addEventListener("submit", async function (event) {
        event.preventDefault();
        const resetMessage = document.getElementById("reset-message");
        resetMessage.textContent = "";
        let data;
        try {
          data = await loadData();
        } catch (error) {
          resetMessage.textContent = error.message;
          return;
        }
        const values = new FormData(resetForm);
        const email = String(values.get("email")).trim().toLowerCase();
        if (!email.endsWith("@mindchamps.local")) {
          resetMessage.textContent = "Email address must end with @mindchamps.local";
          return;
        }
        const user = data.users.find(function (person) { return person.email.toLowerCase() === email; });
        if (!user) {
          resetMessage.textContent = "No account was found for that email.";
          return;
        }
        user.password = String(values.get("newPassword"));
        try {
          await saveData(data);
        } catch (error) {
          resetMessage.textContent = "Could not save the new password. Please try again.";
          return;
        }
        document.getElementById("login-message").textContent = "Password reset successfully. You can now log in.";
        resetForm.reset();
        closeReset();
        document.getElementById("email").focus();
      });
    }
  }

  async function start() {
    if (document.body.classList.contains("page-login")) {
      renderLogin();
      return;
    }
    if (!root) return;
    let data;
    try {
      data = await loadData();
    } catch (error) {
      root.innerHTML = '<main class="portal-main"><div class="portal-notice" role="alert">' +
        escapeHtml(error.message) + "</div></main>";
      return;
    }
    const user = currentUser(data);
    if (!user) {
      window.location.replace("login.html");
      return;
    }
    const isStudentPage = document.body.classList.contains("student-schedule-page");
    if (isStudentPage && user.role !== "student") {
      window.location.replace("portal.html");
      return;
    }
    if (!isStudentPage && user.role === "student") {
      window.location.replace("student.html");
      return;
    }
    const requested = new URLSearchParams(window.location.search).get("view") ||
      (isStudentPage ? "student-schedule" : "dashboard");
    const view = viewNames[requested] ? requested : "dashboard";
    if (isStudentPage && view !== "student-schedule" && view !== "profile") {
      window.location.replace("student.html");
      return;
    }
    if (user.role !== "admin" && (view === "staff" || view === "students" || view === "create-class")) {
      go("dashboard");
      return;
    }
    if (user.role === "admin" && view === "attendance") {
      go("dashboard");
      return;
    }
    const renderers = {
      dashboard: renderDashboard,
      "student-schedule": renderStudentSchedule,
      classes: renderClasses,
      "create-class": renderCreateClass,
      class: renderClass,
      attendance: renderAttendance,
      reports: renderReports,
      archives: renderArchives,
      profile: user.role === "student" ? renderStudentProfile : renderProfile,
      staff: renderStaff,
      students: renderStudents
    };
    renderers[view](data, user);

    if (!window.__MINDCHAMPS_BOUND__) {
      document.addEventListener("submit", handleSubmit);
      document.addEventListener("click", handleClick);
      document.addEventListener("change", handleFilterChange);
      document.addEventListener("input", handleStudentSearchInput);
      window.__MINDCHAMPS_BOUND__ = true;
    }
  }

  try {
    start();
  } catch (error) {
    if (root) {
      root.innerHTML = '<main class="portal-main"><div class="portal-notice" role="alert">' +
        escapeHtml(error.message) + "</div></main>";
    } else {
      const message = document.getElementById("login-message");
      if (message) message.textContent = error.message;
    }
  }
})();