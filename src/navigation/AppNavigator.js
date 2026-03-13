import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, View } from 'react-native';
import { COLORS } from '../config/constants';

// Auth Screens
import SplashScreen from '../screens/auth/SplashScreen';
import LoginScreen from '../screens/auth/LoginScreen';

// Dashboard Screens
import HomeScreen from '../screens/dashboard/HomeScreen';
import MyLoansScreen from '../screens/dashboard/MyLoansScreen';
import LoanDetailScreen from '../screens/dashboard/LoanDetailScreen';
import ProfileScreen from '../screens/dashboard/ProfileScreen';

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

// Admin Screens
import AdminDashboardScreen from '../screens/admin/AdminDashboardScreen';
import LoanQueueScreen from '../screens/admin/LoanQueueScreen';
import RiskDashboardScreen from '../screens/admin/RiskDashboardScreen';
import ApiHealthMonitorScreen from '../screens/admin/ApiHealthMonitorScreen';
import AuditTrailViewerScreen from '../screens/admin/AuditTrailViewerScreen';

const RootStack = createStackNavigator();
const Tab = createBottomTabNavigator();

// Nested stacks for tabs that need sub-navigation
const HomeStackNav = createStackNavigator();
const LoansStackNav = createStackNavigator();
const ProfileStackNav = createStackNavigator();
const AdminHomeStackNav = createStackNavigator();

const noHeader = { headerShown: false };

const TabIcon = ({ label, icon, focused }) => (
  <View style={{ alignItems: 'center', paddingTop: 4 }}>
    <Text style={{ fontSize: 22 }}>{icon}</Text>
    <Text
      style={{
        fontSize: 10,
        color: focused ? COLORS.primary : COLORS.textSecondary,
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

const HomeStack = () => (
  <HomeStackNav.Navigator screenOptions={noHeader}>
    <HomeStackNav.Screen name="HomeMain" component={HomeScreen} />
    <HomeStackNav.Screen name="MyLoans" component={MyLoansScreen} />
    <HomeStackNav.Screen name="CreditScore" component={CreditScoreScreen} />
    <HomeStackNav.Screen name="Referral" component={ReferralScreen} />
    <HomeStackNav.Screen name="Offers" component={OffersScreen} />
    <HomeStackNav.Screen name="DailyCheckIn" component={DailyCheckInScreen} />
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
    <ProfileStackNav.Screen name="MyLoans" component={MyLoansScreen} />
    <ProfileStackNav.Screen name="CreditScore" component={CreditScoreScreen} />
    <ProfileStackNav.Screen name="Referral" component={ReferralScreen} />
    <ProfileStackNav.Screen name="Offers" component={OffersScreen} />
    <ProfileStackNav.Screen name="DailyCheckIn" component={DailyCheckInScreen} />
    {sharedScreens(ProfileStackNav)}
  </ProfileStackNav.Navigator>
);

const tabBarStyle = {
  height: 65,
  paddingBottom: 8,
  backgroundColor: COLORS.surface,
  borderTopWidth: 0.5,
  borderTopColor: COLORS.border,
  elevation: 8,
};

const CustomerTabs = () => (
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
        tabBarIcon: ({ focused }) => <TabIcon label="Home" icon="🏠" focused={focused} />,
      }}
    />
    <Tab.Screen
      name="LoansTab"
      component={LoansStack}
      options={{
        tabBarIcon: ({ focused }) => <TabIcon label="Loans" icon="📋" focused={focused} />,
      }}
    />
    <Tab.Screen
      name="ApplyTab"
      component={InstituteSelectionScreen}
      options={{
        tabBarIcon: ({ focused }) => (
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: 28,
              backgroundColor: COLORS.teal,
              alignItems: 'center',
              justifyContent: 'center',
              marginTop: -20,
              elevation: 4,
            }}
          >
            <Text style={{ fontSize: 28, color: COLORS.textLight }}>+</Text>
          </View>
        ),
      }}
    />
    <Tab.Screen
      name="EngageTab"
      component={DailyCheckInScreen}
      options={{
        tabBarIcon: ({ focused }) => <TabIcon label="Engage" icon="🔥" focused={focused} />,
      }}
    />
    <Tab.Screen
      name="ProfileTab"
      component={ProfileStack}
      options={{
        tabBarIcon: ({ focused }) => <TabIcon label="Profile" icon="👤" focused={focused} />,
      }}
    />
  </Tab.Navigator>
);

const AdminHomeStack = () => (
  <AdminHomeStackNav.Navigator screenOptions={noHeader}>
    <AdminHomeStackNav.Screen name="AdminDashboardMain" component={AdminDashboardScreen} />
    <AdminHomeStackNav.Screen name="LoanQueue" component={LoanQueueScreen} />
    <AdminHomeStackNav.Screen name="RiskDashboard" component={RiskDashboardScreen} />
    <AdminHomeStackNav.Screen name="ApiHealthMonitor" component={ApiHealthMonitorScreen} />
    <AdminHomeStackNav.Screen name="AuditTrailViewer" component={AuditTrailViewerScreen} />
  </AdminHomeStackNav.Navigator>
);

const AdminTabs = () => (
  <Tab.Navigator
    screenOptions={{
      headerShown: false,
      tabBarStyle: {
        ...tabBarStyle,
        elevation: undefined,
      },
      tabBarShowLabel: false,
    }}
  >
    <Tab.Screen
      name="AdminHome"
      component={AdminHomeStack}
      options={{
        tabBarIcon: ({ focused }) => <TabIcon label="Dashboard" icon="📊" focused={focused} />,
      }}
    />
    <Tab.Screen
      name="QueueTab"
      component={LoanQueueScreen}
      options={{
        tabBarIcon: ({ focused }) => <TabIcon label="Queue" icon="📋" focused={focused} />,
      }}
    />
    <Tab.Screen
      name="AdminProfile"
      component={ProfileScreen}
      options={{
        tabBarIcon: ({ focused }) => <TabIcon label="Profile" icon="👤" focused={focused} />,
      }}
    />
  </Tab.Navigator>
);

const AppNavigator = () => (
  <RootStack.Navigator screenOptions={noHeader}>
    {/* Auth */}
    <RootStack.Screen name="Splash" component={SplashScreen} />
    <RootStack.Screen name="Login" component={LoginScreen} />

    {/* Customer Tabs */}
    <RootStack.Screen name="CustomerTabs" component={CustomerTabs} />

    {/* Admin Tabs */}
    <RootStack.Screen name="AdminTabs" component={AdminTabs} />

    {/* Education Loan & Employee Loan screens are inside HomeStack to keep tabs visible */}
  </RootStack.Navigator>
);

export default AppNavigator;
