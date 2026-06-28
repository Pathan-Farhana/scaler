import axios from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export const api = axios.create({
  baseURL: API_URL,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && typeof window !== "undefined") {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.href = "/auth";
    }
    return Promise.reject(err);
  }
);

export const getMediaUrl = (url?: string) => {
  if (!url) return "";
  if (url.startsWith("http")) return url;
  return `${API_URL}${url}`;
};

// Auth
export const authApi = {
  sendOtp: (phone: string) => api.post("/api/auth/send-otp", { phone_number: phone }),
  register: (data: { phone_number: string; display_name: string; password: string; otp: string }) =>
    api.post("/api/auth/register", data),
  login: (data: { phone_number: string; password: string }) => api.post("/api/auth/login", data),
  me: () => api.get("/api/auth/me"),
};

// Users
export const usersApi = {
  search: (q: string) => api.get("/api/users/search", { params: { q } }),
  get: (id: string) => api.get(`/api/users/${id}`),
  updateMe: (data: Partial<{ display_name: string; username: string; about: string; avatar_url: string }>) =>
    api.patch("/api/users/me", data),
  uploadAvatar: (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return api.post("/api/users/me/avatar", fd, { headers: { "Content-Type": "multipart/form-data" } });
  },
  getContacts: () => api.get("/api/users/me/contacts"),
  addContact: (phone_number: string, nickname?: string) =>
    api.post("/api/users/me/contacts", { phone_number, nickname }),
  removeContact: (id: string) => api.delete(`/api/users/me/contacts/${id}`),
};

// Conversations
export const conversationsApi = {
  list: () => api.get("/api/conversations/"),
  get: (id: string) => api.get(`/api/conversations/${id}`),
  createDirect: (user_id: string) => api.post("/api/conversations/direct", { user_id }),
  createGroup: (data: { name: string; description?: string; member_ids: string[] }) =>
    api.post("/api/conversations/group", data),
  updateGroup: (id: string, data: Partial<{ name: string; description: string; avatar_url: string }>) =>
    api.patch(`/api/conversations/group/${id}`, data),
  addMember: (id: string, user_id: string) =>
    api.post(`/api/conversations/group/${id}/members`, { user_id }),
  removeMember: (id: string, user_id: string) =>
    api.delete(`/api/conversations/group/${id}/members/${user_id}`),
  markRead: (id: string) => api.post(`/api/conversations/${id}/read`),
};

// Messages
export const messagesApi = {
  list: (conversationId: string, before?: string) =>
    api.get(`/api/messages/${conversationId}/messages`, { params: before ? { before } : {} }),
  send: (conversationId: string, data: { content?: string; message_type?: string; reply_to_id?: string; disappear_after_seconds?: number }) =>
    api.post(`/api/messages/${conversationId}/messages`, data),
  sendFile: (conversationId: string, file: File, replyToId?: string, disappearAfter?: number) => {
    const fd = new FormData();
    fd.append("file", file);
    if (replyToId) fd.append("reply_to_id", replyToId);
    if (disappearAfter) fd.append("disappear_after_seconds", String(disappearAfter));
    return api.post(`/api/messages/${conversationId}/messages/upload`, fd, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
  delete: (conversationId: string, messageId: string) =>
    api.delete(`/api/messages/${conversationId}/messages/${messageId}`),
  react: (conversationId: string, messageId: string, emoji: string) =>
    api.post(`/api/messages/${conversationId}/messages/${messageId}/react`, { emoji }),
};
