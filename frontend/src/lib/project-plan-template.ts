export type ProjectPlanTemplateActivity = {
  code: string;
  name: string;
  subActivities: string[];
};

export const PROJECT_PLAN_TEMPLATE: ProjectPlanTemplateActivity[] = [
  {
    code: "0",
    name: "Project Management",
    subActivities: [
      "Award of Project / LOA",
      "Submission of Performance security / Bank Guarantee",
      "Signing the Tender Agreement",
      "Kick-off Meeting with client & preliminary site visit",
      "Letter for Proceeding / Work order",
      "Site Office Establishment"
    ]
  },
  {
    code: "1",
    name: "Inception Report & QAP",
    subActivities: [
      "Geometric Design of existing alignment",
      "Submission of QAP",
      "Existing Road and Existing Bridges/Culverts/Structures Inventory",
      "Submission of Draft Inception Report",
      "Comments of client on Draft Inception Report & QAP",
      "Submission of Final Inception Report & QAP",
      "Approval of Final Inception Report & QAP"
    ]
  },
  {
    code: "2",
    name: "Alignment Option Report",
    subActivities: [
      "Traffic surveys and analysis / Traffic Report",
      "Geometric Design for various alignment options",
      "Collection of cadastral maps and revenue records",
      "Collection of reserved/protected forest details",
      "Walkthrough on proposed alignment / bypass / realignment",
      "Public consultation and stakeholders consultation",
      "Final geometric design for alignment options",
      "Submission of Alignment Options Report with presentation",
      "Approval/comments from client on alignment options",
      "Submission of Final Alignment Report",
      "Approval of Final Alignment Report"
    ]
  },
  {
    code: "3",
    name: "Feasibility Report",
    subActivities: [
      "Existing road condition survey / NSV report",
      "Sub-grade soil sample collection and testing",
      "Pavement structural strength survey / FWD report",
      "Pavement design report",
      "Accident data collection / black spots audit report",
      "Existing bridges/culverts/structures condition survey",
      "Material collection and testing report",
      "Submission of Draft Feasibility Report",
      "Comments of client on Draft Feasibility Report",
      "Submission of Final Feasibility Report",
      "Approval of Final Feasibility Report"
    ]
  },
  {
    code: "4",
    name: "LA & Clearance - I Report",
    subActivities: [
      "Publication of 3A/10A Gazette Notification",
      "Preparation of Draft 3A/11 notifications",
      "Estimated cost of land acquisition",
      "Preparation of Strip / LA Plan",
      "Submission of Draft LA-I Report",
      "Comments of client on Draft LA-I Report",
      "Submission of Final LA-I Report",
      "Approval of Final LA-I Report",
      "Identification of surface and sub-surface utilities",
      "Tentative cost of relocation",
      "Submission of utility shifting proposals",
      "Submission of utility relocation plan",
      "Initial consultation and submission of clearance proposals",
      "Submission of Clearance-I Report"
    ]
  },
  {
    code: "5",
    name: "Detailed Project Report",
    subActivities: [
      "Detailed topographic survey on approved alignment",
      "Draft plan-profile design of highway",
      "Finalize proposed structure list",
      "Hydraulic and hydrological investigation report",
      "Geotechnical and sub-soil exploration report",
      "Final plan-profile design with client approval",
      "Detailed estimate of highway",
      "Preparation of proposed structures GADs",
      "Detailed estimate of proposed structures",
      "Preparation of Design Based Report (DBR)",
      "Preparation of miscellaneous drawings",
      "Preparation of drainage design report",
      "Preparation of drainage plan",
      "Economic and financial analysis report",
      "Environmental assessment report including EMP",
      "Socio-economic impact study / RAP",
      "Submission of Draft DPR",
      "Comments of client on Draft DPR",
      "Submission of Final DPR",
      "Approval of Final DPR"
    ]
  },
  {
    code: "6",
    name: "Civil Work Contract Agreement & Technical Schedule",
    subActivities: [
      "Preparation of Technical Schedule (A, B, C, D)",
      "Submission of Draft civil work contract agreement",
      "Submission of Bid Documents (RFP / NIT)",
      "Comments of client on draft agreement and schedule",
      "Submission of final bid documents and contract agreement",
      "Approval of bid documents and contract agreement",
      "Pre-bid query reply",
      "Package award to concessionaire/contractor"
    ]
  },
  {
    code: "7",
    name: "LA & Clearance - II Report",
    subActivities: [
      "Publication of 3A/11 Gazette Notification",
      "Fixing boundary pillar and center line marking",
      "Joint measurement survey with officials",
      "Valuation of existing properties attached to land",
      "Publication of 3D Gazette Notification",
      "Preparation of final Strip / LA Plan",
      "Submission of LA-II Report",
      "Joint site inspection with competent authority",
      "Submission of utility shifting estimates / quotation",
      "Approval of utility shifting estimates / quotation",
      "Submission of final utility relocation plan",
      "Submission of Utility-II Report",
      "Final GAD approval from concerned authority",
      "Clearance approval by competent authority",
      "Submission of Final Clearance-II Report"
    ]
  },
  {
    code: "8",
    name: "Land Award Report (LA-III Report)",
    subActivities: [
      "Award declaration (3G)",
      "Submission of Land Award Report"
    ]
  },
  {
    code: "9",
    name: "Land Possession Report (LA-IV Report)",
    subActivities: [
      "Deposition of compensation amount by Govt. to CALA 3(H)",
      "Disbursement to land owners by CALA",
      "Receipt of Land Possession Certificate 3(E)",
      "Submission of Land Possession Report"
    ]
  }
];
