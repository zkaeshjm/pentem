export interface ReportOutputPlugin {
  write(reportPath: string, format: 'markdown' | 'json' | 'html'): Promise<void>;
}

export class NoopReportOutputPlugin implements ReportOutputPlugin {
  async write(_reportPath: string, _format: 'markdown' | 'json' | 'html'): Promise<void> {
    // no-op
  }
}
