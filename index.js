import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// 🔴 استبدلي هذه القيم بمعلومات مشروعك الخاص من Firebase Console
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Initialize Firebase & Firestore
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// State Variables
let teachers = [];
let students = [];
let activeTeacherId = null;

// Realtime Listener for Teachers
onSnapshot(collection(db, "teachers"), (snapshot) => {
  teachers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  renderTeachers();
  updateGlobalCalculations();
});

// Realtime Listener for Students
onSnapshot(collection(db, "students"), (snapshot) => {
  students = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  renderStudents();
  updateGlobalCalculations();
});

// Add Teacher to Cloud Database
window.addTeacher = async function(e) {
  e.preventDefault();
  const firstName = document.getElementById('teacherFirstName').value.trim();
  const lastName = document.getElementById('teacherLastName').value.trim();
  const price = parseFloat(document.getElementById('teacherPrice').value);

  try {
    await addDoc(collection(db, "teachers"), {
      name: `${firstName} ${lastName}`,
      pricePerLesson: price
    });
    e.target.reset();
  } catch (error) {
    alert("حدث خطأ أثناء الإضافة: " + error.message);
  }
};

// Add Student to Cloud Database
window.addStudent = async function(e) {
  e.preventDefault();
  if(!activeTeacherId) return;

  const firstName = document.getElementById('studentFirstName').value.trim();
  const lastName = document.getElementById('studentLastName').value.trim();

  try {
    await addDoc(collection(db, "students"), {
      teacherId: activeTeacherId,
      name: `${firstName} ${lastName}`,
      attendedLessons: 0,
      absentLessons: 0,
      isPaid: false
    });
    e.target.reset();
  } catch (error) {
    alert("حدث خطأ أثناء الإضافة: " + error.message);
  }
};

// Mark Attendance Live
window.markAttendance = async function(studentId, type) {
  const student = students.find(s => s.id === studentId);
  if(!student) return;

  const studentRef = doc(db, "students", studentId);
  if(type === 'present') {
    await updateDoc(studentRef, { attendedLessons: student.attendedLessons + 1 });
  } else if(type === 'absent') {
    await updateDoc(studentRef, { absentLessons: student.absentLessons + 1 });
  }
};

// Toggle Payment Live
window.togglePayment = async function(studentId) {
  const student = students.find(s => s.id === studentId);
  if(!student) return;

  const studentRef = doc(db, "students", studentId);
  await updateDoc(studentRef, { isPaid: !student.isPaid });
};

// Select Teacher Handler
window.selectTeacher = function(id) {
  activeTeacherId = id;
  renderTeachers();
  const teacher = teachers.find(t => t.id === id);
  
  document.getElementById('selectedTeacherHeader').innerHTML = `
    <h2 class="text-xl font-bold text-indigo-950">الأستاذ: ${teacher.name}</h2>
    <p class="text-xs text-slate-500">سعر الحصة المخصص: ${teacher.pricePerLesson} د.ج</p>
  `;
  document.getElementById('addStudentSection').classList.remove('hidden');
  document.getElementById('currentTeacherName').innerText = teacher.name;

  renderStudents();
};

// Render Teachers List
function renderTeachers() {
  const container = document.getElementById('teachersList');
  container.innerHTML = '';

  if(teachers.length === 0) {
    container.innerHTML = `<p class="text-xs text-slate-400">لا يوجد أساتذة مضافين بعد.</p>`;
    return;
  }

  teachers.forEach(teacher => {
    const isSelected = teacher.id === activeTeacherId;
    const studentCount = students.filter(s => s.teacherId === teacher.id).length;

    const div = document.createElement('div');
    div.className = `p-4 rounded-xl cursor-pointer transition border ${isSelected ? 'bg-indigo-50 border-indigo-500 font-bold' : 'bg-slate-50 hover:bg-slate-100 border-slate-200'}`;
    div.onclick = () => window.selectTeacher(teacher.id);
    div.innerHTML = `
      <div class="flex justify-between items-center">
        <div>
          <p class="text-sm font-bold text-slate-800">${teacher.name}</p>
          <p class="text-xs text-slate-500">${teacher.pricePerLesson} د.ج / للحصة</p>
        </div>
        <span class="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded-md">
          ${studentCount} طلاب
        </span>
      </div>
    `;
    container.appendChild(div);
  });
}

// Render Active Students
function renderStudents() {
  const body = document.getElementById('studentsTableBody');
  body.innerHTML = '';

  const filteredStudents = students.filter(s => s.teacherId === activeTeacherId);
  const teacher = teachers.find(t => t.id === activeTeacherId);

  if(filteredStudents.length === 0) {
    body.innerHTML = `<tr><td colspan="5" class="text-center p-6 text-slate-400">لا يوجد تلاميذ لهذا الأستاذ بعد.</td></tr>`;
    return;
  }

  filteredStudents.forEach(student => {
    const dueAmount = student.attendedLessons * (teacher ? teacher.pricePerLesson : 0);
    const hasAbsenceWarning = student.absentLessons >= 1 && student.absentLessons <= 3;

    let statusBadge = student.isPaid 
      ? `<span class="bg-emerald-100 text-emerald-800 text-xs font-bold px-2 py-1 rounded-full">🟢 تم الدفع</span>`
      : `<span class="bg-red-100 text-red-800 text-xs font-bold px-2 py-1 rounded-full">🔴 لم يدفع</span>`;

    if (hasAbsenceWarning) {
      statusBadge += ` <span class="bg-amber-100 text-amber-800 text-xs font-bold px-2 py-1 rounded-full">🟡 تنبيه غياب (${student.absentLessons})</span>`;
    }

    const tr = document.createElement('tr');
    tr.className = "border-b border-slate-100 text-sm";
    tr.innerHTML = `
      <td class="p-3 font-bold">${student.name}</td>
      <td class="p-3 text-xs">
        <span class="text-emerald-600 font-bold">حضر: ${student.attendedLessons}</span> | 
        <span class="text-red-500 font-bold">غاب: ${student.absentLessons}</span>
      </td>
      <td class="p-3">${statusBadge}</td>
      <td class="p-3 font-bold">${dueAmount} د.ج</td>
      <td class="p-3 flex gap-1">
        <button onclick="window.markAttendance('${student.id}', 'present')" class="bg-emerald-500 hover:bg-emerald-600 text-white text-xs px-2 py-1 rounded">+ حضور</button>
        <button onclick="window.markAttendance('${student.id}', 'absent')" class="bg-amber-500 hover:bg-amber-600 text-white text-xs px-2 py-1 rounded">+ غياب</button>
        <button onclick="window.togglePayment('${student.id}')" class="bg-indigo-600 hover:bg-indigo-700 text-white text-xs px-2 py-1 rounded">
          ${student.isPaid ? 'إلغاء الدفع' : 'تسجيل الدفع'}
        </button>
      </td>
    `;
    body.appendChild(tr);
  });
}

// Calculations Engine
function updateGlobalCalculations() {
  let totalRevenue = 0;
  students.forEach(student => {
    const teacher = teachers.find(t => t.id === student.teacherId);
    if(teacher) {
      totalRevenue += student.attendedLessons * teacher.pricePerLesson;
    }
  });
  document.getElementById('totalAcademyRevenue').innerText = `${totalRevenue.toLocaleString()} د.ج`;
}

// Tab Switcher
window.switchTab = function(tab) {
  document.getElementById('section-teachers').classList.toggle('hidden', tab !== 'teachers');
  document.getElementById('section-unpaid').classList.toggle('hidden', tab !== 'unpaid');

  if(tab === 'unpaid') renderUnpaidList();
};

function renderUnpaidList() {
  const container = document.getElementById('unpaidStudentsBody');
  container.innerHTML = '';
  const unpaid = students.filter(s => !s.isPaid);

  if(unpaid.length === 0) {
    container.innerHTML = `<tr><td colspan="5" class="text-center p-6 text-emerald-600 font-bold">🎉 جميع التلاميذ قاموا بالدفع لهذا الشهر!</td></tr>`;
    return;
  }

  unpaid.forEach(student => {
    const teacher = teachers.find(t => t.id === student.teacherId);
    const amount = student.attendedLessons * (teacher ? teacher.pricePerLesson : 0);

    const tr = document.createElement('tr');
    tr.className = "border-b border-slate-100 text-sm";
    tr.innerHTML = `
      <td class="p-3 font-bold text-red-900">${student.name}</td>
      <td class="p-3">${teacher ? teacher.name : 'غير محدد'}</td>
      <td class="p-3">${student.attendedLessons} حصص</td>
      <td class="p-3 font-black text-red-600">${amount} د.ج</td>
      <td class="p-3">
        <button onclick="window.togglePayment('${student.id}')" class="bg-emerald-600 text-white text-xs px-3 py-1 rounded-lg">تسجيل كمدفوع</button>
      </td>
    `;
    container.appendChild(tr);
  });
}