import { IUsageLogRepository, UsageSummary } from '../../domain/repositories/i-usage-log.repository.js';
import { UsageLog } from '../../domain/entities/usage-log.entity.js';

export class GetUsageStatsUseCase {
  constructor(private readonly usageLogRepo: IUsageLogRepository) {}

  async getSummary(days = 30): Promise<UsageSummary> {
    return this.usageLogRepo.getSummary(days);
  }

  async getRecentLogs(limit = 50): Promise<UsageLog[]> {
    return this.usageLogRepo.getRecentLogs(limit);
  }
}
