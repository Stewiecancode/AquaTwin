import { createContext, useContext } from "react";
import type {
  Sensor,
  Asset,
  Incident,
  Reading,
  Summary,
  Simulation,
  MaintenanceTask,
  Role,
  Notification,
} from "../shared/domain";
export type User = {
  uid: string;
  role: Role;
  team: string;
  municipality: string;
};
export type Data = {
  sensors: Sensor[];
  assets: Asset[];
  incidents: Incident[];
  readings: Reading[];
  summary: Summary;
  simulations: Simulation[];
  tasks: MaintenanceTask[];
  notifications: Notification[];
  settings: any;
  analytics: any;
  user: User;
  query: string;
  perform: (path: string, method: string, data?: unknown) => Promise<any>;
  notify: (s: string) => void;
  simulate: () => void;
};
export const DataContext = createContext<Data>(null!);
export const useData = () => useContext(DataContext);
