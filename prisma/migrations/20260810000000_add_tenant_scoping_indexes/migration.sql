-- CreateIndex
CREATE INDEX "users_teamId_idx" ON "users"("teamId");

-- CreateIndex
CREATE INDEX "clients_userId_idx" ON "clients"("userId");

-- CreateIndex
CREATE INDEX "client_portal_sessions_clientId_idx" ON "client_portal_sessions"("clientId");

-- CreateIndex
CREATE INDEX "transactions_userId_idx" ON "transactions"("userId");

-- CreateIndex
CREATE INDEX "transactions_dealId_idx" ON "transactions"("dealId");

-- CreateIndex
CREATE INDEX "mileage_logs_userId_idx" ON "mileage_logs"("userId");

-- CreateIndex
CREATE INDEX "documents_userId_idx" ON "documents"("userId");

-- CreateIndex
CREATE INDEX "documents_clientId_idx" ON "documents"("clientId");

-- CreateIndex
CREATE INDEX "documents_dealId_idx" ON "documents"("dealId");

-- CreateIndex
CREATE INDEX "team_invites_teamId_idx" ON "team_invites"("teamId");

-- CreateIndex
CREATE INDEX "deals_userId_idx" ON "deals"("userId");

-- CreateIndex
CREATE INDEX "deals_clientId_idx" ON "deals"("clientId");

-- CreateIndex
CREATE INDEX "deals_referralPartnerId_idx" ON "deals"("referralPartnerId");

-- CreateIndex
CREATE INDEX "referral_partners_userId_idx" ON "referral_partners"("userId");

-- CreateIndex
CREATE INDEX "open_houses_dealId_idx" ON "open_houses"("dealId");

-- CreateIndex
CREATE INDEX "open_house_visitors_openHouseId_idx" ON "open_house_visitors"("openHouseId");

-- CreateIndex
CREATE INDEX "deal_deadlines_dealId_idx" ON "deal_deadlines"("dealId");

-- CreateIndex
CREATE INDEX "document_templates_userId_idx" ON "document_templates"("userId");

-- CreateIndex
CREATE INDEX "form_templates_userId_idx" ON "form_templates"("userId");

-- CreateIndex
CREATE INDEX "form_template_signers_formTemplateId_idx" ON "form_template_signers"("formTemplateId");

-- CreateIndex
CREATE INDEX "form_fields_formTemplateId_idx" ON "form_fields"("formTemplateId");

-- CreateIndex
CREATE INDEX "form_fields_signerId_idx" ON "form_fields"("signerId");

-- CreateIndex
CREATE INDEX "form_submissions_userId_idx" ON "form_submissions"("userId");

-- CreateIndex
CREATE INDEX "form_submissions_clientId_idx" ON "form_submissions"("clientId");

-- CreateIndex
CREATE INDEX "form_submissions_dealId_idx" ON "form_submissions"("dealId");

-- CreateIndex
CREATE INDEX "form_submissions_formTemplateId_idx" ON "form_submissions"("formTemplateId");

-- CreateIndex
CREATE INDEX "form_submission_signers_formSubmissionId_idx" ON "form_submission_signers"("formSubmissionId");

-- CreateIndex
CREATE INDEX "form_submission_signers_templateSignerId_idx" ON "form_submission_signers"("templateSignerId");

-- CreateIndex
CREATE INDEX "form_field_values_signerId_idx" ON "form_field_values"("signerId");

-- CreateIndex
CREATE INDEX "assets_userId_idx" ON "assets"("userId");

-- CreateIndex
CREATE INDEX "asset_value_snapshots_assetId_idx" ON "asset_value_snapshots"("assetId");

-- CreateIndex
CREATE INDEX "loans_userId_idx" ON "loans"("userId");

-- CreateIndex
CREATE INDEX "loan_extra_payments_loanId_idx" ON "loan_extra_payments"("loanId");

-- CreateIndex
CREATE INDEX "financial_goals_userId_idx" ON "financial_goals"("userId");

-- CreateIndex
CREATE INDEX "recurring_transaction_templates_userId_idx" ON "recurring_transaction_templates"("userId");
