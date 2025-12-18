# ServiceTitan Platform Overview

**Document Type:** Platform Architecture & Core Concepts  
**Target Audience:** All Users, Administrators, Onboarding  
**Last Updated:** December 17, 2025

---

## Table of Contents

1. [Platform Introduction](#platform-introduction)
2. [System Architecture](#system-architecture)
3. [Navigation & UI Fundamentals](#navigation--ui-fundamentals)
4. [Core Concepts & Terminology](#core-concepts--terminology)
5. [Onboarding Process](#onboarding-process)
6. [User Roles & Permissions](#user-roles--permissions)
7. [System Requirements](#system-requirements)
8. [Getting Started Resources](#getting-started-resources)

---

## Platform Introduction

### What is ServiceTitan?

ServiceTitan is a comprehensive business management platform designed specifically for home services companies (HVAC, plumbing, electrical, etc.). It integrates all aspects of business operations including:

- **Customer Relationship Management (CRM)**
- **Job Scheduling & Dispatching**
- **Mobile Field Management**
- **Estimates & Sales**
- **Invoicing & Payments**
- **Accounting & Financial Management**
- **Reporting & Analytics**
- **Marketing & Customer Communications**

### Platform Benefits

- **Streamlined Communication:** Real-time sync between office and field
- **Improved Efficiency:** Automate repetitive tasks and workflows
- **Increased Revenue:** Better sales tools and customer insights
- **Better Customer Experience:** Faster response and professional service
- **Data-Driven Decisions:** Comprehensive reporting and analytics
- **Scalability:** Grows with your business

---

## System Architecture

### Platform Components

#### 1. Web Application (Office)
The web-based platform accessed by office staff, dispatchers, managers, and administrators.

**Key Features:**
- Full dashboard and reporting access
- Customer and location record management
- Dispatch board and scheduling
- Call booking and customer service
- Accounting and financial management
- Administrative settings and configuration

**Access:** Desktop/laptop browser (Chrome, Edge, Firefox, Safari)

#### 2. Mobile Applications (Field)
Mobile apps used by field technicians on tablets and smartphones.

**Available Apps:**
- **Field Mobile App** (New - 2025+): Modern, faster iOS/Android app
- **ServiceTitan Mobile** (Legacy): Original mobile app (being phased out)

**Key Features:**
- View daily schedule
- Complete jobs and tasks
- Build and present estimates
- Collect payments
- Track time and equipment
- Communicate with office

**Access:** iOS (iPhone/iPad), Android phones and tablets

#### 3. Integration Layer
Connects ServiceTitan with external systems:
- QuickBooks and accounting software
- Payment processors
- GPS and routing services
- Supplier catalogs
- Marketing platforms
- Phone systems

---

## Navigation & UI Fundamentals

### Web Application Navigation

#### Enhanced Navigation Layout
ServiceTitan uses a modern navigation structure with:

**Top Navigation Bar:**
- **Global Search:** Quick access to customers, jobs, invoices
- **Notifications:** System alerts and updates
- **User Profile:** Settings and preferences
- **Help:** Access to knowledge base

**Left Sidebar Menu:**
Main navigation organized by function:
- **Dashboard:** Overview and KPIs
- **Calls:** Call booking and management
- **Dispatch:** Scheduling and dispatch board
- **Jobs:** Job management and tracking
- **Customers:** Customer and location records
- **Sales:** Estimates and opportunities
- **Invoicing:** Invoice creation and management
- **Payments:** Payment processing
- **Accounting:** Financial management
- **Reports:** Analytics and reporting
- **Settings:** System configuration
- **Marketing:** Customer communications

#### Global Search Functionality

**How to Use:**
1. Click search icon (magnifying glass) in top navigation
2. Type search term
3. View results organized by category:
   - Customers
   - Jobs
   - Invoices
   - Estimates
   - Locations
   - Purchase Orders

**Search Tips:**
- Search by customer name, phone, email, address
- Search by job number or invoice number
- Use partial matches for faster results
- Recent searches are saved for quick access

### Mobile App Navigation

#### Field Mobile App Layout

**Main Screens:**
- **Home/Schedule:** Daily job list and appointments
- **Job Details:** Individual job information and tasks
- **Estimates:** Create and present quotes
- **Invoices:** Generate bills and collect payment
- **More:** Additional tools and settings

**Navigation Features:**
- **Tab Bar:** Quick access to main sections
- **Swipe Gestures:** Navigate between jobs
- **Quick Actions:** Context-specific buttons
- **Offline Mode:** Work without internet, syncs when connected

---

## Core Concepts & Terminology

### Key Business Objects

#### Customer
A person or business that receives services from your company.

**Attributes:**
- Name, contact information
- Service address(es)
- Billing information
- Communication preferences
- Service history
- Memberships

#### Location
A physical address where services are performed. A customer can have multiple locations.

**Attributes:**
- Street address
- Property type (residential/commercial)
- Access notes
- Installed equipment
- Service history

#### Job
A work order for services to be performed at a location.

**Attributes:**
- Job number
- Customer and location
- Business unit (HVAC, Plumbing, etc.)
- Assigned technician(s)
- Scheduled date/time
- Job type (service call, installation, maintenance)
- Status (booked, dispatched, in progress, completed)

**Job Lifecycle:**
1. **Booked:** Job created, not yet scheduled
2. **Scheduled:** Assigned to technician with date/time
3. **Dispatched:** Technician notified and en route
4. **In Progress:** Technician working on-site
5. **Completed:** Work finished
6. **Invoiced:** Bill generated
7. **Paid:** Payment collected

#### Project
A large, multi-day, or multi-phase engagement. Projects contain multiple jobs.

**Common Uses:**
- Construction projects
- Large installations
- Renovation work
- Commercial contracts

#### Estimate
A quote or proposal for work to be performed, presented to customer before job completion.

**Components:**
- Service items from pricebook
- Materials and equipment
- Labor costs
- Options/packages
- Total price
- Terms and conditions

**Estimate Statuses:**
- **Draft:** Being created
- **Presented:** Shown to customer
- **Sold:** Approved by customer
- **Dismissed:** Rejected/declined
- **Follow-up:** Pending customer decision

#### Invoice
A bill for completed work or services rendered.

**Components:**
- Services performed
- Materials used
- Labor charges
- Taxes
- Discounts
- Total amount due
- Payment terms

#### Payment
Money collected from customer for services.

**Payment Types:**
- Credit/debit card
- Check
- Cash
- ACH/bank transfer
- Financing

#### Pricebook
Catalog of all services, materials, and equipment your company offers with associated pricing.

**Pricebook Structure:**
- **Services:** Labor-based offerings (e.g., "HVAC Tune-Up")
- **Materials:** Physical items sold/installed (e.g., "Air Filter")
- **Equipment:** Major installations (e.g., "3-Ton AC Unit")

**Pricing Options:**
- Standard pricing
- Dynamic pricing (adjusts based on factors)
- Client-specific pricing (custom rates per customer)
- Flat rate vs. time & materials

### Business Organization

#### Business Unit
A division of your company by trade or service type.

**Examples:**
- HVAC
- Plumbing
- Electrical
- Appliance Repair

**Purpose:**
- Organize teams and technicians
- Separate scheduling and capacity
- Track performance by service line
- Custom pricing by business unit

#### Campaign
Marketing initiative or lead source tracking.

**Uses:**
- Track advertising effectiveness
- Measure ROI by channel
- Assign jobs to marketing sources

### User Roles

#### Technician
Field employee who performs services at customer locations.

**Responsibilities:**
- Complete assigned jobs
- Build and sell estimates
- Collect payments
- Track time and materials
- Communicate job status

#### Dispatcher
Office staff who manages scheduling and coordinates technicians.

**Responsibilities:**
- Book and schedule jobs
- Assign jobs to technicians
- Monitor dispatch board
- Adjust schedules as needed
- Communicate with customers and field

#### CSR (Customer Service Representative)
Office staff who handles customer communications and bookings.

**Responsibilities:**
- Answer incoming calls
- Book appointments
- Create customer records
- Manage customer communications
- Process service agreements

#### Office Manager
Manages day-to-day operations and administrative tasks.

**Responsibilities:**
- Oversee office staff
- Review reports and KPIs
- Manage projects
- Handle escalations
- Process accounting tasks

#### Administrator
Has full system access and manages configuration.

**Responsibilities:**
- User management and permissions
- System settings and configuration
- Integrations and connected services
- Pricebook management
- Business rules and workflows

---

## Onboarding Process

### Company Onboarding Journey

ServiceTitan implementation follows a structured three-phase process:

#### Phase 1: Pre-Implementation

**Duration:** 2-4 weeks before go-live

**Key Activities:**

1. **Workstream Lead Assignment**
   - Assign team members to manage specific implementation areas
   - Workstreams include: Dispatch, Technicians, Pricebook, Accounting, etc.

2. **Discovery Questions**
   - Complete questionnaires about current processes
   - Define business requirements
   - Identify integration needs

3. **TitanAdvisor Prepare to Launch**
   - Interactive guided setup
   - Complete configuration tasks
   - Import initial data
   - Set up business units and teams

4. **Training Setup**
   - Schedule training sessions
   - Set up practice/sandbox environment
   - Assign training materials by role

**Goals:**
- Customize ServiceTitan to match your business
- Prepare data for migration
- Train staff on basics
- Plan go-live strategy

#### Phase 2: Implementation

**Duration:** 4-8 weeks (varies by company size)

**Key Activities:**

1. **Kick-Off Call**
   - Meet implementation consultant
   - Review timeline and milestones
   - Clarify roles and responsibilities

2. **Data Migration**
   - Import customer records
   - Transfer service history
   - Migrate pricebook items
   - Set up integrations

3. **System Configuration**
   - Configure workflows
   - Set up user permissions
   - Customize forms and templates
   - Integrate accounting software
   - Connect payment processors

4. **Training & Testing**
   - Role-specific training sessions
   - Practice in sandbox environment
   - Test critical workflows
   - Conduct dry runs

5. **Go-Live Preparation**
   - Final data verification
   - Staff readiness check
   - Support plan in place
   - Emergency procedures defined

**Goals:**
- Migrate all data successfully
- Configure system to match processes
- Train all staff members
- Ensure readiness for launch

#### Phase 3: Go Live & Beyond

**Duration:** Ongoing (first 90 days critical)

**Key Activities:**

1. **Launch Day**
   - Switch to ServiceTitan for all operations
   - Extra support staff available
   - Monitor for issues
   - Gather immediate feedback

2. **Post-Launch Support**
   - Daily check-ins (first week)
   - Weekly reviews (first month)
   - Monthly reviews (first quarter)
   - Troubleshoot issues

3. **Customer Success Management**
   - Transition from implementation to CSM
   - Regular business reviews
   - Performance optimization
   - Feature adoption guidance

4. **Continuous Improvement with TitanAdvisor**
   - Complete recommended tasks
   - Explore advanced features
   - Optimize workflows
   - Measure and improve KPIs

**Goals:**
- Ensure smooth transition
- Address issues quickly
- Maximize platform adoption
- Achieve business goals

### New User Onboarding

When adding new employees to existing ServiceTitan implementation:

#### For All New Users

1. **Account Creation**
   - Admin creates user account
   - Assigns appropriate role and permissions
   - Sets up login credentials
   - Provides access to relevant modules

2. **Initial Training**
   - Review role-specific documentation
   - Watch training videos
   - Complete ServiceTitan Academy courses
   - Shadow experienced team member

3. **Practice Environment**
   - Use sandbox/practice environment
   - Complete sample workflows
   - Test key features
   - Build confidence before live work

4. **Ongoing Support**
   - Access to help center and knowledge base
   - Team mentorship and coaching
   - Regular check-ins with manager
   - Feedback and questions encouraged

---

## User Roles & Permissions

### Permission Levels

ServiceTitan uses role-based access control (RBAC) to manage what users can see and do.

#### Administrator
**Access Level:** Full system access

**Capabilities:**
- All modules and features
- User management
- System configuration
- Financial data access
- Report access (all)

#### Manager
**Access Level:** Broad operational access

**Capabilities:**
- View and edit jobs, estimates, invoices
- Run reports and dashboards
- Manage team members
- Review financial performance
- Limited system configuration

#### Dispatcher
**Access Level:** Scheduling and job management

**Capabilities:**
- Dispatch board access
- Book and schedule jobs
- Assign technicians
- View customer records
- Limited financial access

#### CSR (Customer Service)
**Access Level:** Customer interaction focused

**Capabilities:**
- Book appointments
- Create/edit customer records
- Process calls
- View job status
- Limited pricing visibility

#### Technician
**Access Level:** Mobile app and assigned jobs

**Capabilities:**
- View own schedule
- Complete assigned jobs
- Create estimates (if permitted)
- Collect payments
- Limited office access

#### Accounting
**Access Level:** Financial operations

**Capabilities:**
- Process payments
- Manage invoices
- Accounting integrations
- Financial reports
- Limited field operations access

### Customizing Permissions

Administrators can customize permissions by:
- Enabling/disabling specific features per role
- Setting visibility rules for pricing and costs
- Controlling edit vs. view-only access
- Restricting access to business units
- Defining approval workflows

---

## System Requirements

### Web Application Requirements

#### Supported Browsers
- **Google Chrome** (latest version) - Recommended
- **Microsoft Edge** (latest version)
- **Mozilla Firefox** (latest version)
- **Apple Safari** (latest version)

#### Computer Requirements
- **Operating System:** Windows 10+, macOS 10.14+, or modern Linux
- **Processor:** Dual-core 2.0 GHz or faster
- **RAM:** 4GB minimum, 8GB recommended
- **Display:** 1280x720 minimum, 1920x1080 recommended
- **Internet:** Stable broadband connection (10 Mbps+ recommended)

### Mobile Application Requirements

#### Field Mobile App (New)
- **iOS:** Version 14.0 or later (iPhone, iPad, iPod Touch)
- **Android:** Version 8.0 (Oreo) or later
- **Storage:** 500MB available space
- **Internet:** 4G/LTE or Wi-Fi for sync (limited offline capability)

#### ServiceTitan Mobile (Legacy)
- **iOS:** Version 12.0 or later
- **Android:** Version 7.0 or later
- **Storage:** 300MB available space

#### Recommended Hardware
- **Tablets:** 
  - iPad (7th generation or later)
  - Samsung Galaxy Tab A or better
  - 10" screen minimum for best experience
- **Phones:** Large-screen smartphones (6"+ display) for basic tasks

### Network & Connectivity

#### Office/Web
- **Connection Type:** Wired Ethernet or reliable Wi-Fi
- **Speed:** 10 Mbps download, 5 Mbps upload minimum
- **Latency:** <100ms preferred
- **Firewall:** Must allow ServiceTitan domains

#### Mobile/Field
- **Cellular:** 4G/LTE data plan (5GB+ per month per technician recommended)
- **Wi-Fi:** Use when available to reduce data usage
- **Offline:** Limited offline mode available, syncs when online
- **GPS:** Required for location tracking and routing

---

## Getting Started Resources

### Help & Documentation

#### ServiceTitan Knowledge Base
- **URL:** help.servicetitan.com
- **Contents:** 
  - How-to articles
  - Video tutorials
  - Best practices
  - FAQs
  - Troubleshooting guides

#### In-App Help
- **TitanAdvisor:** Contextual guidance within ServiceTitan
- **Tool Tips:** Hover over icons for explanations
- **Help Icon:** Access relevant articles from any screen

### Training & Education

#### ServiceTitan Academy
- **URL:** academy.servicetitan.com
- **Offerings:**
  - Role-based learning paths
  - Video courses
  - Certifications
  - Live webinars
  - Best practice guides

**Recommended Courses by Role:**
- **Technicians:** Mobile app training, estimate building
- **Dispatchers:** Dispatch board mastery, capacity planning
- **CSRs:** Call booking, customer service excellence
- **Managers:** Reporting and analytics, team performance
- **Admins:** System configuration, advanced setup

#### Live Training & Webinars
- **New Feature Releases:** Regular webinars on updates
- **Best Practice Sessions:** Learn from top performers
- **Q&A Sessions:** Ask questions and get expert answers
- **Industry-Specific:** Training tailored to HVAC, plumbing, etc.

### Practice & Testing

#### Sandbox Environment
A separate ServiceTitan instance for practice and testing:

**Uses:**
- Train new employees without affecting live data
- Test new workflows before implementing
- Practice using new features
- Experiment with configurations

**Access:** Request through Customer Success Manager

#### ServiceTitan Practice
- **Purpose:** Practice environment for onboarding
- **Duration:** Available during implementation
- **Data:** Sample customers and jobs for training

### Support Channels

#### Technical Support
- **Portal:** Submit support tickets through ServiceTitan
- **Phone:** Available during business hours
- **Response Times:** Based on issue severity
- **Coverage:** Technical issues, bugs, system problems

#### Customer Success Manager (CSM)
- **Assigned:** After go-live (customers on certain plans)
- **Focus:** Business optimization, feature adoption, strategy
- **Cadence:** Regular check-in meetings
- **Proactive:** Recommendations for improvement

#### Community & Forums
- **ServiceTitan Community:** Connect with other users
- **User Groups:** Local and industry-specific groups
- **Ideas Forum:** Submit and vote on feature requests
- **Peer Learning:** Share tips and best practices

---

## Key Success Factors

### For Successful Implementation

1. **Executive Buy-In**
   - Leadership commitment to change
   - Resources allocated for training
   - Clear communication of benefits

2. **Staff Engagement**
   - Include team in planning
   - Address concerns early
   - Celebrate wins and progress

3. **Data Quality**
   - Clean up data before migration
   - Validate imported information
   - Maintain data hygiene ongoing

4. **Process Documentation**
   - Document current workflows
   - Define new processes
   - Create training materials

5. **Training Investment**
   - Adequate time for learning
   - Hands-on practice
   - Ongoing education

6. **Incremental Adoption**
   - Start with core features
   - Add advanced features gradually
   - Master basics before expanding

### For Ongoing Success

1. **Regular Performance Reviews**
   - Monitor KPIs weekly/monthly
   - Identify improvement opportunities
   - Adjust strategies as needed

2. **Continuous Learning**
   - Stay updated on new features
   - Attend webinars and training
   - Learn from ServiceTitan Academy

3. **Leverage Support Resources**
   - Use CSM guidance
   - Submit support tickets promptly
   - Participate in user community

4. **Optimize Workflows**
   - Review processes quarterly
   - Eliminate inefficiencies
   - Automate where possible

5. **Data-Driven Decisions**
   - Use reports to inform strategy
   - Track trends over time
   - Measure ROI on initiatives

---

## ServiceTitan Glossary

**Common Terms and Definitions:**

- **Business Unit:** Organizational division by service type (HVAC, Plumbing, etc.)
- **Campaign:** Marketing source or initiative
- **Capacity:** Available technician hours for job scheduling
- **CSR:** Customer Service Representative
- **CSM:** Customer Success Manager
- **Dispatch Board:** Visual scheduling interface
- **Estimate:** Quote for proposed work
- **Job:** Work order for services
- **Invoice:** Bill for completed work
- **Location:** Physical service address
- **Membership:** Recurring service agreement/maintenance plan
- **Non-Job Event:** Scheduled time that's not a job (meeting, training, etc.)
- **Pricebook:** Catalog of services and materials with pricing
- **Project:** Large, multi-job engagement
- **Technician:** Field employee performing services
- **TitanAdvisor:** In-app guidance system
- **Work Order:** Another term for job

---

## Next Steps

After reviewing this platform overview:

1. **Review your role-specific guide:**
   - [Field Technician Guide](field_tech_guide.md)
   - [Dispatcher Guide](dispatch_guide.md)
   - [Sales Guide](sales_guide.md)
   - [Management Guide](management_guide.md)
   - [Office Staff Guide](office_staff_guide.md)

2. **Complete ServiceTitan Academy courses for your role**

3. **Practice in sandbox environment**

4. **Reach out to your manager or CSM with questions**

5. **Explore the help center for specific how-to articles**

---

*For role-specific workflows and detailed procedures, refer to the appropriate guide in this knowledge base.*

---

**Related Documents:**
- [Index](index.md) - Master navigation guide
- [Field Technician Guide](field_tech_guide.md)
- [Dispatcher Guide](dispatch_guide.md)
- [Sales Guide](sales_guide.md)
- [Management Guide](management_guide.md)
- [Office Staff Guide](office_staff_guide.md)

---

*End of Platform Overview*
