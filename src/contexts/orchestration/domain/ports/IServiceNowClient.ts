export interface IServiceNowClient {
  addWorkNote(ticketId: string, note: string): Promise<void>;
  updateResolution(ticketId: string, resolution: string): Promise<void>;
}
