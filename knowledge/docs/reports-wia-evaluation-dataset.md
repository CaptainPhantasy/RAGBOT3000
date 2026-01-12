---
source: https://www.dol.gov/agencies/eta/reports/wia-evaluation-dataset
scraped_at: 2025-12-26T03:30:32.402556
project: knowledge_bases/workplace_rights
---

> **DISCLAIMER:** This is for informational purposes only. I am an AI, not an attorney or tax professional.

# Workforce Investment Act NonExperimental Net Impact Evaluation Dataset | U.S. Department of Labor

More in This Section 
- [Close](#)
* [Adult Literacy and Education Initiative](/agencies/eta/reports/adult-literacy-education-initiative)
* [ETA Occasional Papers](/agencies/eta/reports/occasional-papers)
* [Enhanced Transitional Jobs Demonstration](/agencies/eta/reports/enhanced-transitional-jobs-demonstration)
* [Examples of ETA Products in Spanish](/agencies/eta/reports/spanish-resources)
* [Hispanic Worker Initiative](/agencies/eta/reports/hispanic-worker-initiative)
* [Project GATE Final Evaluation Dataset](/agencies/eta/reports/project-gate-dataset)
* [Public Workforce System Dataset](/agencies/eta/reports/public-workforce-system-dataset)
* [Research Conferences](/agencies/eta/reports/conference)
* [Technology-Based Learning Initiative](/agencies/eta/reports/technology-based-learning-initiative)
* [Workforce Investment Act NonExperimental Net Impact Evaluation Dataset](/agencies/eta/reports/wia-evaluation-dataset)
* [YouthBuild Program](/agencies/eta/reports/youthbuild)
The administrative data collected by IMPAQ for the "Workforce Investment Act Non-Experimental Net Impact Evaluation" project were received from state agencies in three segments: annual Workforce Investment Act Standardized Record Data (WIASRD) or closely related files, Unemployment Insurance data, and Unemployment Insurance Wage Record data. The analysis were conducted for twelve states; however, based on the data sharing agreements, the Public Use Data (PUD) set includes data for nine states only. Our agreement for use of these data required that the identity of those states was not revealed. As a result, all geographical identifiers were removed to preserve states' anonymity.
The PUD set is provided in three ASCII files with SAS and STATA data definition statements:
1. PUD\_WIA.DAT with PUD\_WIA.SAS, PUD\_WIA.DO, and PUD\_WIA.DCT
2. PUD\_UI.DAT with PUD\_UI.SAS, PUD\_UI.DO, and PUD\_UI.DCT
3. PUD\_WAGES.DAT with PUD\_WAGES.SAS, PUD\_WAGES.DO, and PUD\_WAGES.DCT
4. Download [ZIP](/sites/dolgov/files/ETA/reports/pdfs/wia.zip) file.
Before proceeding with the data cleaning, SSNs and other IDs were first replaced with random identification numbers to ensure that each individual has one unique ID across all components of the PUD set. Please note that invalid SSNs in WIA and UI data were kept, while invalid SSNs in wages data were dropped. As a result, the PUD set includes information for 2,735,007 respondents.
Table of WIA Data processing
During data processing, variable names, variable labels, and value labels were standardized across all states. Additionally, entire record duplicates were removed and the undocumented codes were recoded as missing.
Education was captured in years of attained schooling. In several of the states, a large portion of individuals were coded as having zero years of education. In cases where this number was improbable, we recoded them as missing. Also, education > 24 was recoded to missing and education > 20 but < 24 was recoded to 20. In some states, education was captured as a descriptive variable and following recoding was performed:
> LESS THAN HIGH SCHOOL GRADUATE = 10 years of education  
> SCHOOL GRADUATE OR EQUIVALENT = 12 years of education  
> TECHNICAL OR ASSOCIATES DEGREE = 14 years of education  
> SOME COLLEGE/NO DEGREE = 15 years of education  
> BACHELORS DEGREE = 16 years of education  
> GRADUATE SCHOOL/NO DEGREE = 17 years of education  
> GRADUATE AND/OR PROFESSIONAL DEGREE = 18 years of education
The PUD set includes several date variables and all of them were captured in YYYYMM format. The original dates in format 00000000 or 99999999, or any other format not corresponding to a date were recoded as missing.
Race was categorized into four groups:
:   1=White only
:   2=Black (including black and any other racial category)
:   3=Other (any other specified racial category)
:   4=No racial category identified
The WIA data set was restricted only to those respondents who participated in Adult Local or Dislocated Local programs.
AGE at event < 18 was recoded to missing.
The wages data were provided by states usually with multiple records per ID and year-quarter, with wages from different employers reported on separate records. During the data cleaning, wages for the same year and quarter were summed up and the information about the employer with the highest wages was kept.
In order to preserve states' anonymity, we restricted each data file to quarters of data available across all states:
PUD WIA:
Quarter of entry into WIA: 2003\_3 - 2005\_2
PUD UI:
UI Claim: 2003\_4 - 2006\_4
PUD WAGES:
Earnings: 2002\_2 - 2007\_3
Note that not all states provided the same information, and variables not available in a particular state are coded as missing.
For more details regarding description of variables please see SAS or STATA data definition statements corresponding to each dataset.