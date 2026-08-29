import { apiClient } from "./api";
import { appConfig } from "@/config/app.config";
import { departments as mockDepartments, staffDirectory } from "@/mocks/directory";
import { citizenAreas } from "@/mocks/users";
import { articleCategories, radioCategories, videoTopics } from "@/mocks/cms";
import { budgetYearConfig } from "@/mocks/disbursement";
import type { Staff } from "@/types";

/**
 * Danh mục dùng chung (WBS #9) — nguồn dữ liệu cho mọi dropdown / bộ lọc.
 *
 * Backend dựng danh mục từ giá trị PHÂN BIỆT trong dữ liệu nghiệp vụ thật
 * (cây tổ chức, tài khoản cán bộ, hồ sơ công dân, CMS, ngân sách) nên thêm bản
 * ghi mới là danh mục tự có thêm lựa chọn.
 *
 * Đường lui mock (@/mocks/directory, @/mocks/users, @/mocks/cms,
 * @/mocks/disbursement) giữ nguyên cho chế độ demo.
 */

/** Một cán bộ trong danh bạ phân công — backend KHÔNG trả username/passwordHash */
export type StaffOption = Staff;

interface ListResponse<T> {
  items: T[];
}

function mockDelay<T>(value: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), appConfig.api.mockDelayMs));
}

/** Gọi một danh mục chuỗi đơn giản, có nhánh mock */
async function fetchStringCatalog(path: string, fallback: string[]): Promise<string[]> {
  if (appConfig.api.useMocks) return mockDelay([...fallback]);
  const res = await apiClient.get<ListResponse<string>>(path);
  return res.items;
}

/** GET /catalogs/departments — bộ phận chuyên môn (cây tổ chức) */
export function fetchDepartments(): Promise<string[]> {
  return fetchStringCatalog("/catalogs/departments", mockDepartments);
}

/** GET /catalogs/staff — danh bạ cán bộ cho dropdown phân công */
export async function fetchStaffDirectory(): Promise<StaffOption[]> {
  if (appConfig.api.useMocks) return mockDelay(staffDirectory.map((s) => ({ ...s })));
  const res = await apiClient.get<ListResponse<StaffOption>>("/catalogs/staff");
  return res.items;
}

/** GET /catalogs/areas — thôn / tổ dân phố */
export function fetchCitizenAreas(): Promise<string[]> {
  return fetchStringCatalog("/catalogs/areas", citizenAreas);
}

/** GET /catalogs/article-categories */
export function fetchArticleCategories(): Promise<string[]> {
  return fetchStringCatalog("/catalogs/article-categories", articleCategories);
}

/** GET /catalogs/video-topics */
export function fetchVideoTopics(): Promise<string[]> {
  return fetchStringCatalog("/catalogs/video-topics", videoTopics);
}

/** GET /catalogs/radio-categories */
export function fetchRadioCategories(): Promise<string[]> {
  return fetchStringCatalog("/catalogs/radio-categories", radioCategories);
}

/** GET /catalogs/budget-years — năm mới nhất đứng đầu */
export async function fetchBudgetYears(): Promise<number[]> {
  if (appConfig.api.useMocks) return mockDelay([...budgetYearConfig.years]);
  const res = await apiClient.get<ListResponse<number>>("/catalogs/budget-years");
  return res.items;
}

/** Tra cán bộ theo tên trong danh bạ đã tải — thay cho findStaff của mock */
export function findStaffIn(directory: StaffOption[], name: string): StaffOption | undefined {
  return directory.find((s) => s.name === name);
}
