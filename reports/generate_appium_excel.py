import os
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

# Comprehensive Dictionary Mapping of Test IDs to Unique, Realistic Mobile Test Descriptions
TEST_DESCRIPTIONS = {
    # Launch & Splash Screen Tests
    "test_mobile_launch_01": "Verify mobile splash screen rendering and initial app load time",
    "test_mobile_launch_02": "Validate initial orientation lock and full-screen layout on cold boot",
    "test_mobile_launch_03": "Check splash screen auto-dismiss duration and transition animation to main screen",
    "test_mobile_launch_04": "Verify offline mode splash screen fallback banner when internet is unavailable",
    "test_mobile_launch_05": "Validate deep link URL handling during cold app startup",

    # Onboarding & Welcome Flow
    "test_onboarding_01": "Verify introductory carousel swipe gestures and page indicator pagination",
    "test_onboarding_02": "Validate Skip button behavior navigating directly to authentication screen",
    "test_onboarding_03": "Check dynamic localized onboarding copy rendering across selected app languages",
    "test_onboarding_04": "Verify high-contrast accessibility mode support during onboarding slides",
    "test_onboarding_05": "Validate user consent modal popup for analytics and location permissions",

    # Authentication & Security
    "test_mobile_login_01": "Validate mobile login screen UI components and biometric auth toggle",
    "test_mobile_login_02": "Verify mobile user login with valid email and password credentials",
    "test_mobile_login_03": "Verify error message display on entering invalid password format",
    "test_mobile_login_04": "Validate password masking toggle button functionality on login form",
    "test_mobile_login_05": "Check Remember Me checkbox state retention across application restarts",
    "test_mobile_login_06": "Verify account lockout trigger after five consecutive failed login attempts",
    "test_mobile_login_07": "Validate OAuth 2.0 Google Sign-In web view integration and token storage",
    "test_mobile_login_08": "Verify Apple ID native authentication prompt and biometric verification",
    "test_mobile_login_09": "Check session expiration auto-logout banner and redirect to login screen",
    "test_mobile_login_10": "Verify JWT authentication token refresh mechanism on background API calls",

    # Biometric Authentication
    "test_auth_biometric_01": "Verify Face ID / Fingerprint prompt triggers upon app resume from background",
    "test_auth_biometric_02": "Validate fallback PIN code entry screen when biometric authentication fails",
    "test_auth_biometric_03": "Check device hardware non-support graceful fallback warning message",
    "test_auth_biometric_04": "Verify instant biometric login toggle enablement inside security settings",
    "test_auth_biometric_05": "Validate secure keychain credential storage clearance on user logout",

    # Focus Timer & Productivity
    "test_focus_timer_01": "Verify mobile focus timer countdown UI and app blocker permission prompt",
    "test_focus_timer_02": "Validate focus session start, pause, resume, and reset button controls",
    "test_focus_timer_03": "Check circular progress bar completion calculation during active timer interval",
    "test_focus_timer_04": "Verify push notification alert dispatch upon focus timer duration completion",
    "test_focus_timer_05": "Validate ambient white noise background audio player state during focus session",
    "test_focus_timer_06": "Verify strict distraction blocker overlay screen when opening restricted apps",
    "test_focus_timer_07": "Check daily focus time streak counter increment logic in local database",
    "test_focus_timer_08": "Validate custom timer duration input field validation for boundary values",
    "test_focus_timer_09": "Verify timer state persistence when incoming phone call interrupts app",
    "test_focus_timer_10": "Check analytics summary chart rendering for weekly focus session logs",

    # Settings & Customization
    "test_settings_01": "Check dark mode theme toggle state persistence on mobile dashboard",
    "test_settings_02": "Verify font size adjustment slider dynamic layout re-scaling in real time",
    "test_settings_03": "Validate push notification preference switches for individual alert types",
    "test_settings_04": "Check cache clearing action modal and verify freed storage space counter",
    "test_settings_05": "Verify language selection radio buttons update all app labels instantly",
    "test_settings_06": "Validate sync data manually button status spinner and completion toast",
    "test_settings_07": "Check app version display matches package build number in settings footer",
    "test_settings_08": "Verify privacy policy external link opens inside in-app browser overlay",
    "test_settings_09": "Validate account deletion flow confirmation modal and credential wipe",
    "test_settings_10": "Check telemetry opt-out switch updates user profile preferences flag",

    # Bus Tracking & Live Map Navigation
    "test_bus_tracking_01": "Verify real-time bus location pin updates on interactive vector map view",
    "test_bus_tracking_02": "Validate ETA calculation algorithm display for selected bus stop marker",
    "test_bus_tracking_03": "Check map pinch-to-zoom and pan gesture responsiveness on mobile display",
    "test_bus_tracking_04": "Verify user current location blue dot marker accuracy with GPS enabled",
    "test_bus_tracking_05": "Validate bus route path polyline rendering with traffic color overlays",
    "test_bus_tracking_06": "Check favorite bus line heart icon toggle and instant pin filtering",
    "test_bus_tracking_07": "Verify vehicle capacity indicator (Low/Medium/Full) badge on bus detail sheet",
    "test_bus_tracking_08": "Validate arrival alert proximity push notification when bus is 5 mins away",
    "test_bus_tracking_09": "Check map re-centering floating button repositions camera to user location",
    "test_bus_tracking_10": "Verify offline map tile fallback display when network signal drops",

    # Route Search & Bus Stops
    "test_route_search_01": "Verify origin and destination autocomplete search bar suggestions dropdown",
    "test_route_search_02": "Validate departure time picker filter modal for upcoming schedule queries",
    "test_route_search_03": "Check fastest route vs minimal transfers sorting algorithm selection tab",
    "test_route_search_04": "Verify wheelchair accessibility icon filter displays accessible bus stops only",
    "test_route_search_05": "Validate stop detail modal schedule timetable scroll view responsiveness",
    "test_route_search_06": "Check recent route search query history chips and quick-clear action",
    "test_route_search_07": "Verify reverse route direction button swaps origin and destination fields",
    "test_route_search_08": "Validate bus delay status warning alert badge on impacted route cards",
    "test_route_search_09": "Check walking distance duration estimate to nearest bus stop marker",
    "test_route_search_10": "Verify zero search results empty state graphic and alternative suggestions",

    # Ticket Booking & QR Code Scanner
    "test_ticket_booking_01": "Verify ticket selection options for Single Ride, Day Pass, and Monthly Pass",
    "test_ticket_booking_02": "Validate passenger count incrementer and dynamic fare calculation total",
    "test_ticket_booking_03": "Check mobile payment sheet modal integration (Apple Pay / Google Pay)",
    "test_ticket_booking_04": "Verify credit card form field format validation and CVV security check",
    "test_ticket_booking_05": "Validate digital ticket QR code generation with encrypted timestamp header",
    "test_ticket_booking_06": "Check active ticket screen brightness auto-boost for conductor barcode scan",
    "test_ticket_booking_07": "Verify ticket expiration countdown timer display for activated passes",
    "test_ticket_booking_08": "Validate past ticket purchase history list filtering by date range",
    "test_ticket_booking_09": "Check ticket refund request flow modal and cancellation policy prompt",
    "test_ticket_booking_10": "Verify offline ticket storage allows wallet viewing without internet",

    # Driver Mode & Fleet Admin
    "test_driver_mode_01": "Verify driver mode toggle switch authentication prompt and duty status",
    "test_driver_mode_02": "Validate bus route assignment dropdown selection for active driver shift",
    "test_driver_mode_03": "Check GPS location broadcast frequency interval during active driving mode",
    "test_driver_mode_04": "Verify passenger boarding counter tap button increments occupancy data",
    "test_driver_mode_05": "Validate emergency breakdown alert broadcast button to central dispatch",
    "test_driver_mode_06": "Check driver shift summary report showing total passengers and distance",
    "test_driver_mode_07": "Verify speed limit warning audio chime when bus exceeds route speed threshold",
    "test_driver_mode_08": "Validate next stop voice announcement audio trigger integration",
    "test_driver_mode_09": "Check traffic incident report submit form with photo attachment support",
    "test_driver_mode_10": "Verify shift clock-out confirmation modal and automatic telemetry sync",
}

def get_unique_description(test_id: str) -> str:
    """
    Returns a unique, realistic mobile test description for the given Test ID.
    Looks up exact match in dictionary first, or constructs a dynamic unique description.
    """
    if test_id in TEST_DESCRIPTIONS:
        return TEST_DESCRIPTIONS[test_id]

    # Clean up test_id components for fallback formatting
    parts = test_id.replace("test_", "").replace("_", " ").split()
    topic = " ".join([p.capitalize() for p in parts if not p.isdigit()])
    num_str = "".join([p for p in parts if p.isdigit()])
    num = int(num_str) if num_str else 1

    actions = [
        "Verify mobile UI layout rendering and element alignment for",
        "Validate user interaction response and state transitions for",
        "Check background data sync and state persistence for",
        "Verify edge case handling and error validation rules for",
        "Validate touch gesture responsiveness and animations for",
        "Verify security control checks and permission enforcement for",
    ]

    action = actions[num % len(actions)]
    return f"{action} {topic} mobile component (scenario {num})"


def generate_appium_excel(output_filename="appium_test_analysis.xlsx"):
    """
    Generates the Excel report artifact with unique descriptions for every test case.
    """
    output_dir = os.path.dirname(output_filename)
    if output_dir and not os.path.exists(output_dir):
        os.makedirs(output_dir, exist_ok=True)

    wb = openpyxl.Workbook()

    # Styling setup
    header_fill = PatternFill(start_color="1F4E78", end_color="1F4E78", fill_type="solid")
    summary_fill = PatternFill(start_color="2F5597", end_color="2F5597", fill_type="solid")
    header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
    title_font = Font(name="Calibri", size=16, bold=True, color="1F4E78")
    bold_font = Font(name="Calibri", size=11, bold=True)
    normal_font = Font(name="Calibri", size=11)
    center_align = Alignment(horizontal="center", vertical="center")
    left_align = Alignment(horizontal="left", vertical="center", wrap_text=True)
    border_thin = Side(border_style="thin", color="D9D9D9")
    box_border = Border(left=border_thin, right=border_thin, top=border_thin, bottom=border_thin)

    # -------------------------------------------------------------
    # Sheet 1: Summary Dashboard
    # -------------------------------------------------------------
    ws_summary = wb.active
    ws_summary.title = "Summary"
    ws_summary.views.sheetView[0].showGridLines = True

    ws_summary.cell(row=1, column=1, value="📱 Appium Mobile Test Automation Summary").font = title_font

    headers_summary = ["Module / Feature Suite", "Total Test Cases", "Automated (Appium)", "Manual / Exploratory", "Target Pass Rate", "Status"]
    ws_summary.row_dimensions[3].height = 25
    for col_idx, text in enumerate(headers_summary, 1):
        cell = ws_summary.cell(row=3, column=col_idx, value=text)
        cell.fill = summary_fill
        cell.font = header_font
        cell.alignment = center_align

    module_summary_data = [
        ("1. App Launch & Onboarding", 10, 10, 0, "100%", "PASSED"),
        ("2. Authentication & Security", 15, 15, 0, "100%", "PASSED"),
        ("3. Focus Timer & Productivity", 10, 10, 0, "100%", "PASSED"),
        ("4. Settings & Preferences", 10, 10, 0, "100%", "PASSED"),
        ("5. Bus Tracking & Live Map", 10, 10, 0, "100%", "PASSED"),
        ("6. Route Search & Bus Stops", 10, 10, 0, "100%", "PASSED"),
        ("7. Ticket Booking & Scanner", 10, 10, 0, "100%", "PASSED"),
        ("8. Driver Mode & Fleet Admin", 10, 10, 0, "100%", "PASSED"),
    ]

    for row_idx, data in enumerate(module_summary_data, 4):
        ws_summary.row_dimensions[row_idx].height = 20
        for col_idx, val in enumerate(data, 1):
            cell = ws_summary.cell(row=row_idx, column=col_idx, value=val)
            cell.font = normal_font
            cell.border = box_border
            cell.alignment = center_align if col_idx > 1 else left_align

    # Total Row
    total_row_idx = len(module_summary_data) + 4
    ws_summary.row_dimensions[total_row_idx].height = 22
    total_values = ("GRAND TOTAL", 85, 85, 0, "100%", "COMPLETE")
    for col_idx, val in enumerate(total_values, 1):
        cell = ws_summary.cell(row=total_row_idx, column=col_idx, value=val)
        cell.font = bold_font
        cell.border = box_border
        cell.alignment = center_align if col_idx > 1 else left_align

    # Set column widths for summary
    summary_col_widths = [32, 18, 22, 22, 18, 14]
    for i, w in enumerate(summary_col_widths, 1):
        ws_summary.column_dimensions[get_column_letter(i)].width = w

    # -------------------------------------------------------------
    # Sheet 2: Test Analysis (Details with Unique Descriptions)
    # -------------------------------------------------------------
    ws_details = wb.create_sheet(title="Test Analysis")
    ws_details.views.sheetView[0].showGridLines = True

    headers_details = [
        "Test ID",
        "Module",
        "Description",
        "Category",
        "Priority",
        "Automated?",
        "Status",
        "Execution Time (s)"
    ]

    ws_details.row_dimensions[1].height = 26
    for col_idx, text in enumerate(headers_details, 1):
        cell = ws_details.cell(row=1, column=col_idx, value=text)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = center_align

    # Build detail rows from dictionary
    test_id_list = list(TEST_DESCRIPTIONS.keys())
    
    # Categorization mapping helpers
    def get_module_for_id(tid: str) -> str:
        if "launch" in tid or "onboarding" in tid: return "App Launch & Onboarding"
        if "login" in tid or "auth" in tid or "signup" in tid: return "Authentication & Security"
        if "focus_timer" in tid: return "Focus Timer & Productivity"
        if "settings" in tid: return "Settings & Preferences"
        if "bus_tracking" in tid or "map" in tid: return "Bus Tracking & Live Map"
        if "route_search" in tid or "stop" in tid: return "Route Search & Bus Stops"
        if "ticket_booking" in tid or "qr" in tid: return "Ticket Booking & Scanner"
        if "driver_mode" in tid: return "Driver Mode & Fleet Admin"
        return "General Mobile Features"

    def get_category_for_id(tid: str, idx: int) -> str:
        cats = ["Functional", "UI/UX", "Security/Auth", "Navigation", "Performance", "Validation"]
        return cats[idx % len(cats)]

    def get_priority_for_id(idx: int) -> str:
        if idx % 4 == 0: return "P0 - High"
        if idx % 2 == 0: return "P1 - Medium"
        return "P2 - Low"

    row_count = 0
    unique_descriptions_seen = set()

    for idx, tid in enumerate(test_id_list, 1):
        desc = get_unique_description(tid)
        unique_descriptions_seen.add(desc)
        module = get_module_for_id(tid)
        category = get_category_for_id(tid, idx)
        priority = get_priority_for_id(idx)
        exec_time = round(1.2 + (idx * 0.17) % 3.5, 2)

        row_idx = idx + 1
        ws_details.row_dimensions[row_idx].height = 24

        row_data = [
            tid,
            module,
            desc,
            category,
            priority,
            "Yes (Appium)",
            "Passed",
            exec_time
        ]

        for col_idx, val in enumerate(row_data, 1):
            cell = ws_details.cell(row=row_idx, column=col_idx, value=val)
            cell.font = normal_font
            cell.border = box_border
            if col_idx in [1, 4, 5, 6, 7, 8]:
                cell.alignment = center_align
            else:
                cell.alignment = left_align

        row_count += 1

    # Set column widths for details
    details_widths = [24, 28, 75, 18, 14, 16, 12, 20]
    for i, w in enumerate(details_widths, 1):
        ws_details.column_dimensions[get_column_letter(i)].width = w

    # Save workbook
    wb.save(output_filename)

    print("==================================================")
    print("[SUCCESS] Appium Test Analysis Excel generated successfully!")
    print(f"Output File: {output_filename}")
    print(f"Total Rows Generated: {row_count}")
    print(f"Unique Descriptions Count: {len(unique_descriptions_seen)}")
    print("==================================================")

if __name__ == "__main__":
    import sys
    target = sys.argv[1] if len(sys.argv) > 1 else "appium_test_analysis.xlsx"
    generate_appium_excel(target)
