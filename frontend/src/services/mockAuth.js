export const roles = {
  faculty: "Dr. P MALATHI",
  cr: "Mr N THARUN",
  student: "RAJA SURIYA",
};

export const mockUsers = {
  Faculty: {
    role: roles.faculty,
    name: "Dr. P MALATHI",
    email: "malathipr@srmist.edu.in",
  },
  CR: {
    role: roles.cr,
    name: "Mr N THARUN",
    email: "nt0143@srmist.edu.in",
  },
  Student: {
    role: roles.student,
    id: "RA2311003010002",
    name: "RAJA SURIYA",
    email: "mn1002@srmist.edu.in",
  },
};

const sessionKey = "cse-c-dashboard-user";

export function getCurrentUser() {
  const storedUser = window.localStorage.getItem(sessionKey);

  if (!storedUser) {
    return mockUsers.Faculty;
  }

  try {
    return JSON.parse(storedUser);
  } catch {
    return mockUsers.Faculty;
  }
}

export function setMockUser(role) {
  const user = mockUsers[role] || mockUsers.Faculty;
  window.localStorage.setItem(sessionKey, JSON.stringify(user));
  return user;
}

export function clearMockUser() {
  window.localStorage.removeItem(sessionKey);
}

export function isStudent(user = getCurrentUser()) {
  return user.role === roles.student;
}
