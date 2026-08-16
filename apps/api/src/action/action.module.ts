import { Module } from "@nestjs/common";
import { PrismaModule } from "../common/prisma/prisma.module";
import { AuditModule } from "../audit/audit.module";
import { IdentityModule } from "../identity/identity.module";
import { NotificationModule } from "../notification/notification.module";
import { PredictionsController } from "./predictions.controller";
import { AlertsController } from "./alerts.controller";
import { AlertDecisionController } from "./alert-decision.controller";
import { AutoTriggerRuleController } from "./auto-trigger-rule.controller";
import { AlertService } from "./alert.service";
import { AlertFormatterService } from "./alert-formatter.service";
import { AlertEscalationService } from "./alert-escalation.service";
import { RecommendationService } from "./recommendation.service";
import { AutoTriggerEvaluatorService } from "./auto-trigger-evaluator.service";
import { SourcingCandidatesService } from "./sourcing-candidates.service";

@Module({
  imports: [PrismaModule, AuditModule, IdentityModule, NotificationModule],
  controllers: [
    PredictionsController,
    AlertsController,
    AlertDecisionController,
    AutoTriggerRuleController,
  ],
  providers: [
    AlertService,
    AlertFormatterService,
    AlertEscalationService,
    RecommendationService,
    AutoTriggerEvaluatorService,
    SourcingCandidatesService,
  ],
  exports: [
    AlertService,
    AlertFormatterService,
    RecommendationService,
    AutoTriggerEvaluatorService,
    SourcingCandidatesService,
  ],
})
export class ActionModule {}
