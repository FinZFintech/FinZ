import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, View, ActivityIndicator } from 'react-native';
import { COLORS } from '../config/constants';
import { useAuth } from '../store/AuthContext';
import { useTheme } from '../store/ThemeContext';
import { useLoan } from '../store/LoanContext';

// Auth Screens
import LoginScreen from '../screens/auth/LoginScreen';

// Dashboard Screens
import HomeScreen from '../screens/dashboard/HomeScreen';
import MyLoansScreen from '../screens/dashboard/MyLoansScreen';
import LoanDetailScreen from '../screens/dashboard/LoanDetailScreen';
import ProfileScreen from '../screens/dashboard/ProfileScreen';
import PersonalDetailsScreen from '../screens/dashboard/PersonalDetailsScreen';
import GuardianManagementScreen from '../screens/dashboard/GuardianManagementScreen';

// Education Loan Screens
import InstituteSelectionScreen from '../screens/loan/education/InstituteSelectionScreen';
import StudentDetailsScreen from '../screens/loan/education/StudentDetailsScreen';
import BorrowerSelectionScreen from '../screens/loan/education/BorrowerSelectionScreen';
import PanVerificationScreen from '../screens/loan/education/PanVerificationScreen';
import KycVerificationScreen from '../screens/loan/education/KycVerificationScreen';
import SelfieVerificationScreen from '../screens/loan/education/SelfieVerificationScreen';
import BankDetailsScreen from '../screens/loan/education/BankDetailsScreen';
import IncomeVerificationScreen from '../screens/loan/education/IncomeVerificationScreen';
import VkycScreen from '../screens/loan/education/VkycScreen';
import EnachEsignScreen from '../screens/loan/education/EnachEsignScreen';
import LoanSuccessScreen from '../screens/loan/education/LoanSuccessScreen';

// Higher Education Loan Screens (domestic + abroad)
import HigherEducationSelectionScreen from '../screens/loan/highered/HigherEducationSelectionScreen';
import SupportingDocumentsScreen from '../screens/loan/highered/SupportingDocumentsScreen';

// Employee Loan Screens
import EmployeeLoanScreen from '../screens/loan/employee/EmployeeLoanScreen';

// Servicing Screens
import PrepaymentScreen from '../screens/servicing/PrepaymentScreen';
import NocRequestScreen from '../screens/servicing/NocRequestScreen';

// Engagement Screens
import CreditScoreScreen from '../screens/engagement/CreditScoreScreen';
import ReferralScreen from '../screens/engagement/ReferralScreen';
import OffersScreen from '../screens/engagement/OffersScreen';
import DailyCheckInScreen from '../screens/engagement/DailyCheckInScreen';

// Support Screens
import HelpSupportScreen from '../screens/support/HelpSupportScreen';
import TermsAndConditionsScreen from '../screens/support/TermsAndConditionsScreen';
import PrivacyPolicyScreen from '../screens/support/PrivacyPolicyScreen';
import LoanAssistanceScreen from '../screens/support/LoanAssistanceScreen';

// Admin / Role-based Screens
import AdminDashboardScreen from '../screens/admin/AdminDashboardScreen';
import SalesDashboardScreen from '../screens/admin/SalesDashboardScreen';
import CreditDashboardScreen from '../screens/admin/CreditDashboardScreen';
import OperationsDashboardScreen from '../screens/admin/OperationsDashboardScreen';
import LoanQueueScreen from '../screens/admin/LoanQueueScreen';
import RiskDashboardScreen from '../screens/admin/RiskDashboardScreen';
import ApiHealthMonitorScreen from '../screens/admin/ApiHealthMonitorScreen';
import AuditTrailViewerScreen from '../screens/admin/AuditTrailViewerScreen';
import StaffApplicationDetailScreen from '../screens/admin/StaffApplicationDetailScreen';
import UserManagementScreen from '../screens/admin/UserManagementScreen';
import VendorConfigScreen from '../screens/admin/VendorConfigScreen';
import HigherEdCatalogScreen from '../screens/admin/HigherEdCatalogScreen';
import FBot from '../components/fbot/FBot';

const RootStack = createStackNavigator();
const Tab = createBottomTabNavigator();

// Nested stacks for tabs that need sub-navigation
const HomeStackNav = createStackNavigator();
const LoansStackNav = createStackNavigator();
const ProfileStackNav = createStackNavigator();
const AdminHomeStackNav = createStackNavigator();
const SalesHomeStackNav = createStackNavigator();
const CreditHomeStackNav = createStackNavigator();
const OpsHomeStackNav = createStackNavigator();
const QueueStackNav = createStackNavigator();

const noHeader = { headerShown: false };

const TabIcon = ({ label, icon, focused, colors }) => (
  <View style={{ alignItems: 'center', paddingTop: 4 }}>
    <Text style={{ fontSize: 22 }}>{icon}</Text>
    <Text
      style={{
        fontSize: 10,
        color: focused ? colors.teal : colors.textSecondary,
        fontWeight: focused ? '700' : '400',
        marginTop: 2,
      }}
    >
      {label}
    </Text>
  </View>
);

// Shared detail screens registered in multiple tab stacks
const sharedScreens = (Stack) => (
  <>
    <Stack.Screen name="LoanDetail" component={LoanDetailScreen} />
    <Stack.Screen name="Prepayment" component={PrepaymentScreen} />
    <Stack.Screen name="NocRequest" component={NocRequestScreen} />
  </>
);

// Shared Queue stack so "View Details" works from the Queue tab
const QueueStack = () => (
  <QueueStackNav.Navigator screenOptions={noHeader}>
    <QueueStackNav.Screen name="LoanQueueMain" component={LoanQueueScreen} />
    <QueueStackNav.Screen name="StaffApplicationDetail" component={StaffApplicationDetailScreen} />
  </QueueStackNav.Navigator>
);

// ─── Customer Navigation ────────────────────────────────────────────────────

const HomeStack = () => (
  <HomeStackNav.Navigator screenOptions={noHeader}>
    <HomeStackNav.Screen name="HomeMain" component={HomeScreen} />
    <HomeStackNav.Screen name="MyLoans" component={MyLoansScreen} />
    <HomeStackNav.Screen name="CreditScore" component={CreditScoreScreen} />
    <HomeStackNav.Screen name="Referral" component={ReferralScreen} />
    <HomeStackNav.Screen name="Offers" component={OffersScreen} />
    <HomeStackNav.Screen name="DailyCheckIn" component={DailyCheckInScreen} />
    <HomeStackNav.Screen name="HelpSupport" component={HelpSupportScreen} />
    <HomeStackNav.Screen name="TermsAndConditions" component={TermsAndConditionsScreen} />
    <HomeStackNav.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
    <HomeStackNav.Screen name="LoanAssistance" component={LoanAssistanceScreen} />
    {sharedScreens(HomeStackNav)}
    {/* Education Loan Flow */}
    <HomeStackNav.Screen name="InstituteSelection" component={InstituteSelectionScreen} />
    <HomeStackNav.Screen name="StudentDetails" component={StudentDetailsScreen} />
    <HomeStackNav.Screen name="BorrowerSelection" component={BorrowerSelectionScreen} />
    <HomeStackNav.Screen name="PanVerification" component={PanVerificationScreen} />
    <HomeStackNav.Screen name="IncomeVerification" component={IncomeVerificationScreen} />
    <HomeStackNav.Screen name="KycVerification" component={KycVerificationScreen} />
    <HomeStackNav.Screen name="SelfieVerification" component={SelfieVerificationScreen} />
    <HomeStackNav.Screen name="BankDetails" component={BankDetailsScreen} />
    <HomeStackNav.Screen name="VkycScreen" component={VkycScreen} />
    <HomeStackNav.Screen name="EnachEsign" component={EnachEsignScreen} />
    <HomeStackNav.Screen name="LoanSuccess" component={LoanSuccessScreen} />
    {/* Higher Education Loan (domestic + abroad) */}
    <HomeStackNav.Screen name="HigherEducationSelection" component={HigherEducationSelectionScreen} />
    <HomeStackNav.Screen name="SupportingDocuments" component={SupportingDocumentsScreen} />
    {/* Employee Loan */}
    <HomeStackNav.Screen name="EmployeeLoan" component={EmployeeLoanScreen} />
    {/* Risk Monitoring (accessible from loan flow) */}
    <HomeStackNav.Screen name="RiskDashboard" component={RiskDashboardScreen} />
    <HomeStackNav.Screen name="ApiHealthMonitor" component={ApiHealthMonitorScreen} />
    <HomeStackNav.Screen name="AuditTrailViewer" component={AuditTrailViewerScreen} />
  </HomeStackNav.Navigator>
);

const LoansStack = () => (
  <LoansStackNav.Navigator screenOptions={noHeader}>
    <LoansStackNav.Screen name="MyLoansMain" component={MyLoansScreen} />
    {sharedScreens(LoansStackNav)}
  </LoansStackNav.Navigator>
);

const ProfileStack = () => (
  <ProfileStackNav.Navigator screenOptions={noHeader}>
    <ProfileStackNav.Screen name="ProfileMain" component={ProfileScreen} />
    <ProfileStackNav.Screen name="PersonalDetails" component={PersonalDetailsScreen} />
    <ProfileStackNav.Screen name="GuardianManagement" component={GuardianManagementScreen} />
    <ProfileStackNav.Screen name="MyLoans" component={MyLoansScreen} />
    <ProfileStackNav.Screen name="CreditScore" component={CreditScoreScreen} />
    <ProfileStackNav.Screen name="Referral" component={ReferralScreen} />
    <ProfileStackNav.Screen name="Offers" component={OffersScreen} />
    <ProfileStackNav.Screen name="DailyCheckIn" component={DailyCheckInScreen} />
    <ProfileStackNav.Screen name="HelpSupport" component={HelpSupportScreen} />
    <ProfileStackNav.Screen name="TermsAndConditions" component={TermsAndConditionsScreen} />
    <ProfileStackNav.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
    <ProfileStackNav.Screen name="LoanAssistance" component={LoanAssistanceScreen} />
    {sharedScreens(ProfileStackNav)}
  </ProfileStackNav.Navigator>
);

// Maps FBot onAction events → LoanContext dispatch payloads.
// Kept outside the component so it doesn't re-create per render.
const buildFBotDispatcher = (dispatch) => (action) => {
  if (!action || !action.type) return;
  switch (action.type) {
    case 'SET_NAME':
      dispatch({ type: 'SET_BORROWER_DETAILS', payload: { name: action.value } });
      return;
    case 'SET_DOB':
      dispatch({ type: 'SET_BORROWER_DETAILS', payload: { dob: action.value } });
      return;
    case 'SET_PHONE':
      dispatch({ type: 'SET_BORROWER_DETAILS', payload: { phone: action.value } });
      return;
    case 'VERIFY_PAN':
      dispatch({ type: 'SET_PAN', payload: { panNumber: action.value, verified: true } });
      return;
    case 'SET_OCCUPATION':
      dispatch({ type: 'SET_BORROWER_DETAILS', payload: { occupation: action.value } });
      return;
    case 'SET_EMPLOYER':
      dispatch({ type: 'SET_BORROWER_DETAILS', payload: { employer: action.value } });
      return;
    case 'SET_MONTHLY_INCOME':
      dispatch({ type: 'SET_INCOME', payload: { monthlyIncome: action.value } });
      return;
    case 'SET_LOAN_AMOUNT':
      dispatch({ type: 'SET_PRODUCT', payload: { requestedAmount: action.value } });
      return;
    case 'SET_TENURE':
      dispatch({ type: 'SET_TENURE', payload: action.value });
      return;
    case 'SET_IFSC':
      dispatch({ type: 'SET_BANK_DETAILS', payload: { ifsc: action.value } });
      return;
    case 'SET_ACCOUNT':
      dispatch({ type: 'SET_BANK_DETAILS', payload: { accountNumber: action.value } });
      return;
    case 'VERIFY_BANK':
      dispatch({ type: 'SET_PENNY_DROP', payload: { verified: true } });
      return;
    default:
      // SEND_OTP / VERIFY_OTP / START_KYC / VERIFY_KYC_OTP / START_SELFIE
      // are side-effects; the underlying screens handle them, so we no-op here.
      return;
  }
};

const CustomerTabs = () => {
  const { colors } = useTheme();
  const { dispatch } = useLoan();
  const fbotDispatcher = React.useMemo(() => buildFBotDispatcher(dispatch), [dispatch]);
  const tabBarStyle = {
    height: 65,
    paddingBottom: 8,
    backgroundColor: colors.headerBg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    elevation: 0,
  };

  return (
    <View style={{ flex: 1 }}>
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarStyle,
          tabBarShowLabel: false,
        }}
      >
        <Tab.Screen
          name="Home"
          component={HomeStack}
          options={{
            tabBarIcon: ({ focused }) => <TabIcon label="Home" icon="🏠" focused={focused} colors={colors} />,
          }}
        />
        <Tab.Screen
          name="LoansTab"
          component={LoansStack}
          options={{
            tabBarIcon: ({ focused }) => <TabIcon label="Loans" icon="📋" focused={focused} colors={colors} />,
          }}
        />
        <Tab.Screen
          name="ApplyTab"
          component={InstituteSelectionScreen}
          options={{
            tabBarIcon: () => (
              <View
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 28,
                  backgroundColor: colors.teal,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginTop: -20,
                  elevation: 4,
                }}
              >
                <Text style={{ fontSize: 28, color: colors.background }}>+</Text>
              </View>
            ),
          }}
        />
        <Tab.Screen
          name="EngageTab"
          component={DailyCheckInScreen}
          options={{
            tabBarIcon: ({ focused }) => <TabIcon label="Engage" icon="🔥" focused={focused} colors={colors} />,
          }}
        />
        <Tab.Screen
          name="ProfileTab"
          component={ProfileStack}
          options={{
            tabBarIcon: ({ focused }) => <TabIcon label="Profile" icon="👤" focused={focused} colors={colors} />,
          }}
        />
      </Tab.Navigator>
      <FBot onAction={fbotDispatcher} />
    </View>
  );
};

// ─── Admin Navigation ───────────────────────────────────────────────────────

const AdminHomeStack = () => (
  <AdminHomeStackNav.Navigator screenOptions={noHeader}>
    <AdminHomeStackNav.Screen name="AdminDashboardMain" component={AdminDashboardScreen} />
    <AdminHomeStackNav.Screen name="LoanQueue" component={LoanQueueScreen} />
    <AdminHomeStackNav.Screen name="RiskDashboard" component={RiskDashboardScreen} />
    <AdminHomeStackNav.Screen name="ApiHealthMonitor" component={ApiHealthMonitorScreen} />
    <AdminHomeStackNav.Screen name="AuditTrailViewer" component={AuditTrailViewerScreen} />
    <AdminHomeStackNav.Screen name="StaffApplicationDetail" component={StaffApplicationDetailScreen} />
    <AdminHomeStackNav.Screen name="UserManagement" component={UserManagementScreen} />
    <AdminHomeStackNav.Screen name="VendorConfig" component={VendorConfigScreen} />
    <AdminHomeStackNav.Screen name="HigherEdCatalog" component={HigherEdCatalogScreen} />
  </AdminHomeStackNav.Navigator>
);

const AdminTabs = () => {
  const { colors } = useTheme();
  const tabBarStyle = {
    height: 65,
    paddingBottom: 8,
    backgroundColor: colors.headerBg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  };

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle,
        tabBarShowLabel: false,
      }}
    >
      <Tab.Screen
        name="AdminHome"
        component={AdminHomeStack}
        options={{
          tabBarIcon: ({ focused }) => <TabIcon label="Dashboard" icon="📊" focused={focused} colors={colors} />,
        }}
      />
      <Tab.Screen
        name="QueueTab"
        component={QueueStack}
        options={{
          tabBarIcon: ({ focused }) => <TabIcon label="Queue" icon="📋" focused={focused} colors={colors} />,
        }}
      />
      <Tab.Screen
        name="AdminProfile"
        component={ProfileScreen}
        options={{
          tabBarIcon: ({ focused }) => <TabIcon label="Profile" icon="👤" focused={focused} colors={colors} />,
        }}
      />
    </Tab.Navigator>
  );
};

// ─── Sales Navigation ───────────────────────────────────────────────────────

const SalesHomeStack = () => (
  <SalesHomeStackNav.Navigator screenOptions={noHeader}>
    <SalesHomeStackNav.Screen name="SalesDashboardMain" component={SalesDashboardScreen} />
    <SalesHomeStackNav.Screen name="LoanQueue" component={LoanQueueScreen} />
    <SalesHomeStackNav.Screen name="StaffApplicationDetail" component={StaffApplicationDetailScreen} />
  </SalesHomeStackNav.Navigator>
);

const SalesTabs = () => {
  const { colors } = useTheme();
  const tabBarStyle = {
    height: 65,
    paddingBottom: 8,
    backgroundColor: colors.headerBg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  };

  return (
    <Tab.Navigator
      screenOptions={{ headerShown: false, tabBarStyle, tabBarShowLabel: false }}
    >
      <Tab.Screen
        name="SalesHome"
        component={SalesHomeStack}
        options={{
          tabBarIcon: ({ focused }) => <TabIcon label="Dashboard" icon="📊" focused={focused} colors={colors} />,
        }}
      />
      <Tab.Screen
        name="SalesQueue"
        component={QueueStack}
        options={{
          tabBarIcon: ({ focused }) => <TabIcon label="Applications" icon="📋" focused={focused} colors={colors} />,
        }}
      />
      <Tab.Screen
        name="SalesProfile"
        component={ProfileScreen}
        options={{
          tabBarIcon: ({ focused }) => <TabIcon label="Profile" icon="👤" focused={focused} colors={colors} />,
        }}
      />
    </Tab.Navigator>
  );
};

// ─── Credit Navigation ──────────────────────────────────────────────────────

const CreditHomeStack = () => (
  <CreditHomeStackNav.Navigator screenOptions={noHeader}>
    <CreditHomeStackNav.Screen name="CreditDashboardMain" component={CreditDashboardScreen} />
    <CreditHomeStackNav.Screen name="LoanQueue" component={LoanQueueScreen} />
    <CreditHomeStackNav.Screen name="StaffApplicationDetail" component={StaffApplicationDetailScreen} />
  </CreditHomeStackNav.Navigator>
);

const CreditTabs = () => {
  const { colors } = useTheme();
  const tabBarStyle = {
    height: 65,
    paddingBottom: 8,
    backgroundColor: colors.headerBg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  };

  return (
    <Tab.Navigator
      screenOptions={{ headerShown: false, tabBarStyle, tabBarShowLabel: false }}
    >
      <Tab.Screen
        name="CreditHome"
        component={CreditHomeStack}
        options={{
          tabBarIcon: ({ focused }) => <TabIcon label="Dashboard" icon="📊" focused={focused} colors={colors} />,
        }}
      />
      <Tab.Screen
        name="CreditQueue"
        component={QueueStack}
        options={{
          tabBarIcon: ({ focused }) => <TabIcon label="Bucket" icon="📋" focused={focused} colors={colors} />,
        }}
      />
      <Tab.Screen
        name="CreditProfile"
        component={ProfileScreen}
        options={{
          tabBarIcon: ({ focused }) => <TabIcon label="Profile" icon="👤" focused={focused} colors={colors} />,
        }}
      />
    </Tab.Navigator>
  );
};

// ─── Operations Navigation ──────────────────────────────────────────────────

const OpsHomeStack = () => (
  <OpsHomeStackNav.Navigator screenOptions={noHeader}>
    <OpsHomeStackNav.Screen name="OpsDashboardMain" component={OperationsDashboardScreen} />
    <OpsHomeStackNav.Screen name="LoanQueue" component={LoanQueueScreen} />
    <OpsHomeStackNav.Screen name="StaffApplicationDetail" component={StaffApplicationDetailScreen} />
  </OpsHomeStackNav.Navigator>
);

const OpsTabs = () => {
  const { colors } = useTheme();
  const tabBarStyle = {
    height: 65,
    paddingBottom: 8,
    backgroundColor: colors.headerBg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  };

  return (
    <Tab.Navigator
      screenOptions={{ headerShown: false, tabBarStyle, tabBarShowLabel: false }}
    >
      <Tab.Screen
        name="OpsHome"
        component={OpsHomeStack}
        options={{
          tabBarIcon: ({ focused }) => <TabIcon label="Dashboard" icon="📊" focused={focused} colors={colors} />,
        }}
      />
      <Tab.Screen
        name="OpsQueue"
        component={QueueStack}
        options={{
          tabBarIcon: ({ focused }) => <TabIcon label="Bucket" icon="📋" focused={focused} colors={colors} />,
        }}
      />
      <Tab.Screen
        name="OpsProfile"
        component={ProfileScreen}
        options={{
          tabBarIcon: ({ focused }) => <TabIcon label="Profile" icon="👤" focused={focused} colors={colors} />,
        }}
      />
    </Tab.Navigator>
  );
};

// ─── Root Navigator ─────────────────────────────────────────────────────────

const AppNavigator = () => {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.surface }}>
        <ActivityIndicator size="large" color={COLORS.teal} />
      </View>
    );
  }

  const role = user?.role || 'customer';

  const getRoleScreen = () => {
    switch (role) {
      case 'admin':
        return <RootStack.Screen name="AdminTabs" component={AdminTabs} />;
      case 'sales':
        return <RootStack.Screen name="SalesTabs" component={SalesTabs} />;
      case 'credit':
        return <RootStack.Screen name="CreditTabs" component={CreditTabs} />;
      case 'operations':
        return <RootStack.Screen name="OpsTabs" component={OpsTabs} />;
      default:
        return <RootStack.Screen name="CustomerTabs" component={CustomerTabs} />;
    }
  };

  return (
    <RootStack.Navigator screenOptions={noHeader}>
      {!isAuthenticated ? (
        <RootStack.Screen name="Login" component={LoginScreen} />
      ) : (
        getRoleScreen()
      )}
    </RootStack.Navigator>
  );
};

export default AppNavigator;
