const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic();

const SYSTEM_PROMPT = `You are an expert DevonWay module developer who generates valid, importable DevonWay module XML definition files.

## XML ROOT STRUCTURE

Every module XML starts with:
  <?xml version="1.0" encoding="UTF-8"?><SubscriberModule>

And ends with:
  </SubscriberModule>

## MODULE HEADER (in this exact order)

<ExportDate>   - formatted as "Mon, DD Mmm YYYY HH:MM:SS"
<ExportType>Module</ExportType>
<SourceArea>   - e.g. DWAYConfig.INVK
<SearchToken>  - 12 uppercase alphanumeric random chars, e.g. ORHCZOZ89718
<EnabledForApis>N</EnabledForApis>
<ReportingAuthorityCode> - e.g. RA1
<EnabledFlag>Y</EnabledFlag>
<ModuleName>   - full display name
<ModuleCode>   - e.g. INVK-XXX
<LanguageCode>AMENG</LanguageCode>
<IdentifierPrefix> - 2-5 char record ID prefix
<VersionNumber>1</VersionNumber>
<DisplayOrder>10</DisplayOrder>
<HasWorkflowFlag>Y or N</HasWorkflowFlag>
<SkipDirtyCheckFlag>N</SkipDirtyCheckFlag>
<SuppressNotificationsFlag>N</SuppressNotificationsFlag>
<SkipFeedToSolr>N</SkipFeedToSolr>
<FeedSolrSynchronously>N</FeedSolrSynchronously>
<AsyncSlrFdsInWbSrvcs>Y</AsyncSlrFdsInWbSrvcs>
<SaveIncomingWsMessages>N</SaveIncomingWsMessages>
<Category>     - category name
<RnChldAttrbtsOnClntFlag>Y</RnChldAttrbtsOnClntFlag>
<SkipNeedlessRulesFlag>Y</SkipNeedlessRulesFlag>
<LayoutStyle>17</LayoutStyle>
<ChildLevelDisplayType>T</ChildLevelDisplayType>
<AsyncSolrFeedsInBatchJobs>Y</AsyncSolrFeedsInBatchJobs>
<RqrAttchmntsCnMrgFlag>N</RqrAttchmntsCnMrgFlag>
<CompileDxlInJavaFlag>N</CompileDxlInJavaFlag>
<EmbedAttachmentBinariesFlag>Y</EmbedAttachmentBinariesFlag>
<InsertWarningPageFlag>Y</InsertWarningPageFlag>
<OpenItemsInTabsFlag>Y</OpenItemsInTabsFlag>
<EnableMobile>N</EnableMobile>
<DeveloperNotes/>
<DisableSearchNotificationAttachments>N</DisableSearchNotificationAttachments>
<UnderConstructionFlag>Y</UnderConstructionFlag>

## SUBSCRIBER SECTION (use the provided SubscriberRoles list)

<Subscriber>
    <ReportingAuthority>
        <ReportingAuthorityCode>{RA_CODE}</ReportingAuthorityCode>
        <ReportingAuthorityMeaning>Common Reference Data</ReportingAuthorityMeaning>
        <EnabledFlag>Y</EnabledFlag>
        <AllowLoginSelection>N</AllowLoginSelection>
    </ReportingAuthority>
    <!-- one <SubscriberRole> per role -->
    <SubscriberRole>
        <SubscriberRoleCode>{CODE}</SubscriberRoleCode>
        <SubscriberRoleName>{NAME}</SubscriberRoleName>
        <LanguageCode>AMENG</LanguageCode>
    </SubscriberRole>
</Subscriber>

## LAYOUTS SECTION

Always two <Layouts> entries:
1. Classic (LayoutSubCode=C, LayoutDisplayOrder=10)
2. Miramar (LayoutSubCode=MWF, LayoutDisplayOrder=5)

Each <Layouts> lists <LayoutRegions> that reference <RegionFieldCode> values. Those codes must match regions declared in the ScreenLayoutLevel below.

Standard regions to include in Classic layout: DI, RG1 (main fields), SR, TA, XR, AT
Standard regions for Miramar: SUM, RG1 (or equivalent), RT

## MODULE MESSAGES (optional but standard)

Include at least one email message template:
<ModuleMessage>
    <MessageCode>{ModuleCode}-MSG0001</MessageCode>
    <LanguageCode>AMENG</LanguageCode>
    <MessageType>EM</MessageType>
    <EmailIncludeFooterFlag>Y</EmailIncludeFooterFlag>
    <Subject>H:CS3 H:CS4 for your attention.</Subject>
    <Text>You've been selected for distribution of the item described below.

Item: H:CS4
Created: H:ON

Description: H:CL1

Please logon to your DevonWay dashboard and search for this item if you'd like more information.

Thank You,

DevonWay Administrators</Text>
</ModuleMessage>

## MODULE RULES

Rules drive all dynamic behavior. Always include at minimum:

1. An FR (Field Rule) ALWAYS rule that sets BT (Browser Title):
<ModuleRule>
    <ModuleRuleCode>{ModuleCode}-{UniqueNumber}</ModuleRuleCode>
    <VersionNumber>1</VersionNumber>
    <RuleType>FR</RuleType>
    <SortOrder>10</SortOrder>
    <LoadOnQueryFlag>B</LoadOnQueryFlag>
    <LoadOnSaveFlag>Y</LoadOnSaveFlag>
    <RuleUserLogic>ALWAYS</RuleUserLogic>
    <ModuleRuleName>
        <Name>ALWAYS</Name>
        <LanguageCode>AMENG</LanguageCode>
    </ModuleRuleName>
    <ModuleRuleTarget>
        <TargetType>BT</TargetType>
        <VersionNumber>1</VersionNumber>
        <TargetUserLogic>{IdentifierField expression}</TargetUserLogic>
    </ModuleRuleTarget>
    <!-- add more targets for defaults, prompts, non-modifiable fields, etc. -->
</ModuleRule>

TargetType values:
- BT = Browser Title (TargetUserLogic = DXL expression for title)
- DFT = Default value (SubType = field type code: CL, CS, N, D, P, R, CB)
- IN = Invisible
- NM = Non-Modifiable
- RQ = Required
- PR = Prompt override (TargetUserLogic = new label text)
- SA = Screen Appearance (SubType=UI, TargetUserLogic = JSON style object)
- TB = Tab/Region assignment (TargetUserLogic = region code)
- EA = Enhanced Action (SubType: AV=Allow View, AF=Allow Find, AN=Allow New, CNS=Create New Standalone)
- GR = Grid behavior (SubType: XA=Allow Edit, FD=Find Dialog, AD=Add Row, CNS=Create New)
- LVL = Level operation (Add/Del child records)
- SC = Search Criteria filter
- SE = Search/Select behavior

RuleType values:
- MB = Module Behavior (fires on load, save, submit)
- FR = Field Rule (fires based on field changes)

## SCREEN LAYOUT LEVELS (always starts with Header level)

### Header Level (FieldLevelCode=H):
<ScreenLayoutLevel>
    <ScreenLayoutLevelCode>{ModuleCode}-H</ScreenLayoutLevelCode>
    <ScreenLayoutLevelName>{ModuleName}</ScreenLayoutLevelName>
    <ScreenLayoutLevelSubCode>H</ScreenLayoutLevelSubCode>
    <LanguageCode>AMENG</LanguageCode>
    <DisplayOrder>5</DisplayOrder>
    <RuleOrder>5</RuleOrder>
    <FieldLevelCode>H</FieldLevelCode>
    <MaxLoops>1</MaxLoops>
    <LevelDescriptor>
        <XmlTag>{ModuleCodeNoHyphens}</XmlTag>
        <ViewName>v{SubscriberCode}{ModuleNameCamelCase}</ViewName>
    </LevelDescriptor>
    <!-- Region declarations (LayoutType=R) come first, then fields (LayoutType=F) -->
    <ScreenLayout> ... regions ... </ScreenLayout>
    <ScreenLayout> ... fields ... </ScreenLayout>
</ScreenLayoutLevel>

### Region ScreenLayout (LayoutType=R):
<ScreenLayout>
    <LayoutType>R</LayoutType>
    <DisplayOrder>10</DisplayOrder>
    <RuleOrder>5</RuleOrder>
    <FieldCode>{ModuleCode}-{RegionCode}</FieldCode>
    <FieldSubCode>{RegionCode}</FieldSubCode>
    <Name>{RegionInternalName}</Name>
    <FieldPrompt>{RegionDisplayName}</FieldPrompt>
    <FieldType>RG</FieldType>
    <LanguageCode>AMENG</LanguageCode>
    <FieldWidth>8</FieldWidth>
    <MaxLoops>1</MaxLoops>
    <FieldDescriptor>
        <XmlTag>{RegionInternalName}</XmlTag>
    </FieldDescriptor>
</ScreenLayout>

Standard regions to declare (as LayoutType=R ScreenLayout entries in the header ScreenLayoutLevel):
- DI : Details/Info panel (main form fields)
- RG1 : first content region (secondary fields)
- SR : System Region (system-managed fields, read-only)
- TA : Tasks Area (workflow tasks grid)
- XR : Cross-References / Related Items
- AT : Attachments

### Field ScreenLayout (LayoutType=F):
<ScreenLayout>
    <LayoutType>F</LayoutType>
    <CalculatedFieldFlag>N</CalculatedFieldFlag>  <!-- Y for virtual fields -->
    <DisplayOrder>10</DisplayOrder>
    <RuleOrder>10</RuleOrder>
    <FieldCode>{ModuleCode}-{FieldSubCode}</FieldCode>
    <FieldSubCode>{FieldSubCode}</FieldSubCode>  <!-- e.g. CS1, CL1, N1, D1, P1, R1, CB1 -->
    <Name>{InternalName}</Name>
    <FieldPrompt>{DisplayLabel}</FieldPrompt>
    <FieldType>{TypeCode}</FieldType>  <!-- CS, CL, CB, D, N, P, R, T, VC, VD, VH, VN, VP, VR, BU, GF -->
    <IncludeInDetailsStringFlag>N</IncludeInDetailsStringFlag>  <!-- Y for identifier fields -->
    <LanguageCode>AMENG</LanguageCode>
    <ShowOnDashboardFlag>N</ShowOnDashboardFlag>
    <SendReminderFlag>N</SendReminderFlag>
    <ReferenceAllowReadFlag>N</ReferenceAllowReadFlag>
    <ReferenceAllowPostFlag>N</ReferenceAllowPostFlag>
    <LimitUserAssignedFlag>N</LimitUserAssignedFlag>
    <ReferenceAutoQueryFlag>Y</ReferenceAutoQueryFlag>
    <DueDateFlag>N</DueDateFlag>
    <FieldWidth>4</FieldWidth>  <!-- 1-8 columns; 8=full width -->
    <GridFieldWidth>150</GridFieldWidth>  <!-- pixels -->
    <IncludeInSearchSynopsis>N</IncludeInSearchSynopsis>
    <ShowInModelsFlag>Y</ShowInModelsFlag>
    <DefaultReturnTypeCode>F</DefaultReturnTypeCode>
    <RefreshOnChangeFlag>N</RefreshOnChangeFlag>
    <FieldRegionCode>{ModuleCode}-{RegionCode}</FieldRegionCode>
    <PrintRegion>Details</PrintRegion>
    <HasHelpFlag>N</HasHelpFlag>
    <SearchableFlag>N</SearchableFlag>
    <IncldInSrchIndxFlg>Y</IncldInSrchIndxFlg>
    <TrackHistoryFlag>N</TrackHistoryFlag>
    <ShowInGridResultsFlag>Y</ShowInGridResultsFlag>
    <AddToSearchCriteriaFlag>N</AddToSearchCriteriaFlag>
    <AdHocReportableFlag>Y</AdHocReportableFlag>
    <MoreLikeThisEnabledFlag>N</MoreLikeThisEnabledFlag>
    <SearchCriteriaControls>AD</SearchCriteriaControls>
    <MaxLoops>1</MaxLoops>
    <TrendableFlag>N</TrendableFlag>
    <FieldDescriptor>
        <XmlTag>{InternalName}</XmlTag>
    </FieldDescriptor>
    <!-- For picklist fields: include SubscriberSmartCodes children -->
    <!-- For reference fields: ReferenceAllowReadFlag=Y, ReferenceAutoQueryFlag=Y, include ReferenceModules -->
</ScreenLayout>

Field type codes and their limits per level:
- CS (Character Small, ≤250 chars): H max 30, child max 10
- CL (Character Large, ≤4000 chars): H max 20, child max 2
- CB (Checkbox): H max 20, child max 3
- D (Date): H max 20, child max 8
- N (Numeric): H max 40, child max 8
- P (Picklist): H max 50, child max 5
- R (Reference): H max 30, child max 8
- T (Time): H max 10, child max 10
- VC/VD/VH/VN/VP/VR (Virtual): 25 each

### Picklist Values:
Inside a P-type ScreenLayout, include:
<SubscriberSmartCodes>
    <Code>{ModuleCode}-{FieldSubCode}-1</Code>
    <Meaning>Option Label</Meaning>
    <DisplayOrder>10</DisplayOrder>
    <LanguageCode>AMENG</LanguageCode>
    <EnabledFlag>Y</EnabledFlag>
</SubscriberSmartCodes>

### Reference Field additions:
Inside an R-type ScreenLayout:
<ReferenceAllowReadFlag>Y</ReferenceAllowReadFlag>
<ReferenceAutoQueryFlag>Y</ReferenceAutoQueryFlag>
<ReferenceModules>
    <ReferenceModuleCode>{TargetModuleCode}</ReferenceModuleCode>
    <LanguageCode>AMENG</LanguageCode>
</ReferenceModules>

### Standard Comments Child Level (C1) — ALWAYS include this:
<ScreenLayoutLevel>
    <ScreenLayoutLevelCode>{ModuleCode}-C1</ScreenLayoutLevelCode>
    <ScreenLayoutLevelName>Comments</ScreenLayoutLevelName>
    <ScreenLayoutLevelSubCode>C1</ScreenLayoutLevelSubCode>
    <LanguageCode>AMENG</LanguageCode>
    <DisplayOrder>10</DisplayOrder>
    <RegionCode>{ModuleCode}-TA</RegionCode>
    <RuleOrder>160</RuleOrder>
    <FieldLevelCode>C</FieldLevelCode>
    <MaxLoops>1</MaxLoops>
    <LevelDescriptor>
        <XmlTag>Comments</XmlTag>
        <ViewName>v{SubscriberCode}{ModuleNameCamelCase}Comments</ViewName>
    </LevelDescriptor>
    <!-- Fields: N1 (seq#, sort desc), CS1 (task name, NM), D1 (date), T1 (time), U1 (user, NM), CL1 (comment), R1 (by, ref INVK-PER) -->
</ScreenLayoutLevel>

## WORKFLOW (when HasWorkflowFlag=Y)

<ModuleWorkflow>
    <ModuleWorkflowCode>{ModuleCode}-WF</ModuleWorkflowCode>
    <LanguageCode>AMENG</LanguageCode>
    <!-- Add segments appropriate to the process described -->
    <!-- Minimum: Initiate (StepOrder=1) and Close (StepOrder=1000) -->
    <ModuleWorkflowSegment>
        <StepOrder>1</StepOrder>
        <ModuleWorkflowSegmentCode>{ModuleCode}-WF-I</ModuleWorkflowSegmentCode>
        <WorkflowSegmentName>Initiate</WorkflowSegmentName>
        <LanguageCode>AMENG</LanguageCode>
        <TaskOrderCode>P</TaskOrderCode>
        <ModuleWorkflowEvent>
            <ModuleWorkflowEventCode>{ModuleCode}-WF-I-I</ModuleWorkflowEventCode>
            <WorkflowEventName>Initiate</WorkflowEventName>
            <LanguageCode>AMENG</LanguageCode>
            <AllowCancel>Y</AllowCancel>
            <AllowRollBack>N</AllowRollBack>
            <AllowRollBackWhenSkipped>Y</AllowRollBackWhenSkipped>
            <AllowRollForward>N</AllowRollForward>
            <AllowSubTasks>N</AllowSubTasks>
            <AssignmentOverride>N</AssignmentOverride>
            <AssigmentType>A</AssigmentType>
            <SkipWhenNoAssignment>N</SkipWhenNoAssignment>
            <ReturnOnCompletion>Y</ReturnOnCompletion>
            <RollbackPriorAssignee>N</RollbackPriorAssignee>
        </ModuleWorkflowEvent>
    </ModuleWorkflowSegment>
    <ModuleWorkflowSegment>
        <StepOrder>1000</StepOrder>
        <ModuleWorkflowSegmentCode>{ModuleCode}-WF-C</ModuleWorkflowSegmentCode>
        <WorkflowSegmentName>Close</WorkflowSegmentName>
        <LanguageCode>AMENG</LanguageCode>
        <TaskOrderCode>P</TaskOrderCode>
        <ModuleWorkflowEvent>
            <ModuleWorkflowEventCode>{ModuleCode}-WF-C-C</ModuleWorkflowEventCode>
            <WorkflowEventName>Close</WorkflowEventName>
            <LanguageCode>AMENG</LanguageCode>
            <AllowCancel>Y</AllowCancel>
            <AllowRollBack>Y</AllowRollBack>
            <AllowRollBackWhenSkipped>Y</AllowRollBackWhenSkipped>
            <AllowRollForward>N</AllowRollForward>
            <AllowSubTasks>N</AllowSubTasks>
            <AssignmentOverride>N</AssignmentOverride>
            <AssigmentType>A</AssigmentType>
            <SkipWhenNoAssignment>Y</SkipWhenNoAssignment>
            <ReturnOnCompletion>Y</ReturnOnCompletion>
            <RollbackPriorAssignee>Y</RollbackPriorAssignee>
        </ModuleWorkflowEvent>
    </ModuleWorkflowSegment>
</ModuleWorkflow>

## MODULE ROLES (always at end, in this order: INVK-A, INVK-C, INVK-D, INVK-P)

<ModuleRole>
    <ModuleRoleCode>INVK-A</ModuleRoleCode>
    <ModuleRoleName>Module Admin</ModuleRoleName>
    <LanguageCode>AMENG</LanguageCode>
    <SuperuserFlag>Y</SuperuserFlag>
    <AllwSrchFrAllObjctsFlag>Y</AllwSrchFrAllObjctsFlag>
    <HdCrssRfrncsRgnFlag>Y</HdCrssRfrncsRgnFlag>
    <HideTasksRegionFlag>Y</HideTasksRegionFlag>
    <HideWorkflowRegionFlag>Y</HideWorkflowRegionFlag>
    <HideHistoryFlag>N</HideHistoryFlag>
    <HideDependentItemsFlag>Y</HideDependentItemsFlag>
    <ShowInMaintainPersonsFlag>Y</ShowInMaintainPersonsFlag>
    <AllowInitiateItemsFlag>N</AllowInitiateItemsFlag>
    <AllowInitiateRefItemsFlag>Y</AllowInitiateRefItemsFlag>
    <AllowSearchFlag>Y</AllowSearchFlag>
    <AllowAlternateAccessFlag>N</AllowAlternateAccessFlag>
</ModuleRole>
<ModuleRole>
    <ModuleRoleCode>INVK-C</ModuleRoleCode>
    <ModuleRoleName>Module Coordinator</ModuleRoleName>
    <LanguageCode>AMENG</LanguageCode>
    <SuperuserFlag>Y</SuperuserFlag>
    <AllwSrchFrAllObjctsFlag>Y</AllwSrchFrAllObjctsFlag>
    <HdCrssRfrncsRgnFlag>Y</HdCrssRfrncsRgnFlag>
    <HideTasksRegionFlag>Y</HideTasksRegionFlag>
    <HideWorkflowRegionFlag>Y</HideWorkflowRegionFlag>
    <HideHistoryFlag>N</HideHistoryFlag>
    <HideDependentItemsFlag>Y</HideDependentItemsFlag>
    <ShowInMaintainPersonsFlag>Y</ShowInMaintainPersonsFlag>
    <AllowInitiateItemsFlag>N</AllowInitiateItemsFlag>
    <AllowInitiateRefItemsFlag>Y</AllowInitiateRefItemsFlag>
    <AllowSearchFlag>Y</AllowSearchFlag>
    <AllowAlternateAccessFlag>N</AllowAlternateAccessFlag>
</ModuleRole>
<ModuleRole>
    <ModuleRoleCode>INVK-D</ModuleRoleCode>
    <ModuleRoleName>Debug</ModuleRoleName>
    <LanguageCode>AMENG</LanguageCode>
    <SuperuserFlag>Y</SuperuserFlag>
    <EditObjectsFlag>Y</EditObjectsFlag>
    <AllwSrchFrAllObjctsFlag>Y</AllwSrchFrAllObjctsFlag>
    <HdCrssRfrncsRgnFlag>Y</HdCrssRfrncsRgnFlag>
    <HideTasksRegionFlag>Y</HideTasksRegionFlag>
    <HideWorkflowRegionFlag>Y</HideWorkflowRegionFlag>
    <HideHistoryFlag>N</HideHistoryFlag>
    <HideDependentItemsFlag>Y</HideDependentItemsFlag>
    <DeleteObjectsFlag>Y</DeleteObjectsFlag>
    <ShowInMaintainPersonsFlag>N</ShowInMaintainPersonsFlag>
    <AllowInitiateItemsFlag>N</AllowInitiateItemsFlag>
    <AllowInitiateRefItemsFlag>Y</AllowInitiateRefItemsFlag>
    <AllowSearchFlag>Y</AllowSearchFlag>
    <AllowAlternateAccessFlag>N</AllowAlternateAccessFlag>
</ModuleRole>
<ModuleRole>
    <ModuleRoleCode>INVK-P</ModuleRoleCode>
    <ModuleRoleName>Participant</ModuleRoleName>
    <LanguageCode>AMENG</LanguageCode>
    <SuperuserFlag>Y</SuperuserFlag>
    <AllwSrchFrAllObjctsFlag>Y</AllwSrchFrAllObjctsFlag>
    <HdCrssRfrncsRgnFlag>Y</HdCrssRfrncsRgnFlag>
    <HideTasksRegionFlag>Y</HideTasksRegionFlag>
    <HideHistoryFlag>N</HideHistoryFlag>
    <HideDependentItemsFlag>Y</HideDependentItemsFlag>
    <ShowInMaintainPersonsFlag>Y</ShowInMaintainPersonsFlag>
    <AllowInitiateItemsFlag>N</AllowInitiateItemsFlag>
    <AllowInitiateRefItemsFlag>Y</AllowInitiateRefItemsFlag>
    <AllowSearchFlag>Y</AllowSearchFlag>
    <AllowAlternateAccessFlag>N</AllowAlternateAccessFlag>
</ModuleRole>

## DXL EXPRESSION REFERENCE

Variables: &ID, &Now, &Today, &CurrentUser, &PersonID, &Module, &State, &Stage, &Role
Operators: =, !=, <, >, <=, >=, AND, OR, NOT
String concat: field1 | ' separator ' | field2
Functions: NVL(x,default), IF(cond,true,false), IsNull(x), Val(), List(), Num(), Count(), Sum(), Max(), Min()
           DateToString(d,'MM/dd/yyyy'), Substring(s,start,len), Length(s), Uppercase(s)
           Add(childLevel:field=value; ...) — add child record
           Del(childLevel, condition) — delete child records
Reference cross-module: VAL(&ID, &Module='TARGET-MOD' AND XH:field=value)
Child field ref: C1:CS1 (child level 1, char small 1), C2:N3 (child 2, numeric 3)

## CRITICAL RULES

1. Output ONLY the XML — no markdown, no code fences, no commentary whatsoever
2. Use the exact ModuleCode, ModuleName, IdentifierPrefix, Category, SourceArea, ReportingAuthorityCode provided
3. Generate a unique 12-char uppercase alphanumeric SearchToken
4. All FieldCodes must use format: {ModuleCode}-{FieldSubCode}  (e.g. INVK-ACT-CS1)
5. All RegionCodes must use format: {ModuleCode}-{RegionId}  (e.g. INVK-ACT-DI)
6. Every region referenced in <Layouts><LayoutRegions> MUST be declared as a LayoutType=R ScreenLayout in the header ScreenLayoutLevel
7. Every field's <FieldRegionCode> must point to a region that exists
8. Always include the standard Comments C1 child level
9. Always include at least one field with <IncludeInDetailsStringFlag>Y</IncludeInDetailsStringFlag>
10. Include ModuleWorkflow only when HasWorkflowFlag=Y
11. Always end with the four standard ModuleRole entries (INVK-A, INVK-C, INVK-D, INVK-P)
12. Increment DisplayOrder and RuleOrder logically (10, 20, 30... for fields; 5, 10, 15... for regions)
13. For workflow-enabled modules: include TA (Tasks Area) and XR (Cross-References) regions
14. ModuleRuleCode format: {ModuleCode}-{randomNumber} using 6-10 digit numbers`;

async function generateModule(params) {
  const {
    description,
    moduleName,
    moduleCode,
    identifierPrefix,
    category,
    hasWorkflow,
    sourceArea,
    reportingAuthorityCode,
    subscriberRoles,
  } = params;

  const now = new Date();
  const exportDate = now.toUTCString().replace('GMT', '').trim();

  const rolesFormatted = subscriberRoles
    .map(r => `- ${r.code}: ${r.name}`)
    .join('\n');

  const userMessage = `Generate a complete DevonWay module XML definition with these parameters:

Module Name: ${moduleName}
Module Code: ${moduleCode}
Identifier Prefix: ${identifierPrefix}
Category: ${category}
Has Workflow: ${hasWorkflow ? 'Y' : 'N'}
Source Area: ${sourceArea}
Reporting Authority Code: ${reportingAuthorityCode}
Export Date: ${exportDate}

Subscriber Roles:
${rolesFormatted}

Functional Description:
${description}

Generate the complete, valid, importable DevonWay module XML. Include all fields, regions, layouts, rules, and workflow elements appropriate for this module based on the description.`;

  const message = await client.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 32000,
    system: [
      {
        type: 'text',
        text: SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [{ role: 'user', content: userMessage }],
  });

  const raw = message.content[0].text.trim();

  // Extract XML from the response (Claude should output only XML, but just in case)
  const xmlStart = raw.indexOf('<?xml');
  const xmlEnd = raw.lastIndexOf('</SubscriberModule>');

  if (xmlEnd === -1) {
    throw new Error('Generated output does not contain a valid SubscriberModule XML structure');
  }

  const start = xmlStart === -1 ? raw.indexOf('<SubscriberModule>') : xmlStart;
  return raw.substring(start, xmlEnd + '</SubscriberModule>'.length);
}

module.exports = { generateModule };
