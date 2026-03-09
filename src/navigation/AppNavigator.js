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

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

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

const CustomerTabs = () => (
  <Tab.Navigator
    screenOptions={{
      headerShown: false,
      tabBarStyle: {
        height: 65,
        paddingBottom: 8,
        backgroundColor: COLORS.surface,
        borderTopWidth: 0.5,
        borderTopColor: COLORS.border,
        elevation: 8,
      },
      tabBarShowLabel: false,
    }}
  >
    <Tab.Screen
      name="Home"
      component={HomeScreen}
      options={{
        tabBarIcon: ({ focused }) => <TabIcon label="Home" icon="🏠" focused={focused} />,
      }}
    />
    <Tab.Screen
      name="LoansTab"
      component={MyLoansScreen}
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
              backgroundColor: COLORS.primary,
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
      component={ProfileScreen}
      options={{
        tabBarIcon: ({ focused }) => <TabIcon label="Profile" icon="👤" focused={focused} />,
      }}
    />
  </Tab.Navigator>
);

const AdminTabs = () => (
  <Tab.Navigator
    screenOptions={{
      headerShown: false,
      tabBarStyle: {
        height: 65,
        paddingBottom: 8,
        backgroundColor: COLORS.surface,
        borderTopWidth: 0.5,
        borderTopColor: COLORS.border,
      },
      tabBarShowLabel: false,
    }}
  >
    <Tab.Screen
      name="AdminHome"
      component={AdminDashboardScreen}
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
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    {/* Auth */}
    <Stack.Screen name="Splash" component={SplashScreen} />
    <Stack.Screen name="Login" component={LoginScreen} />

    {/* Customer Tabs */}
    <Stack.Screen name="CustomerTabs" component={CustomerTabs} />

    {/* Admin Tabs */}
    <Stack.Screen name="AdminTabs" component={AdminTabs} />

    {/* Education Loan Flow */}
    <Stack.Screen name="InstituteSelection" component={InstituteSelectionScreen} />
    <Stack.Screen name="StudentDetails" component={StudentDetailsScreen} />
    <Stack.Screen name="BorrowerSelection" component={BorrowerSelectionScreen} />
    <Stack.Screen name="PanVerification" component={PanVerificationScreen} />
    <Stack.Screen name="KycVerification" component={KycVerificationScreen} />
    <Stack.Screen name="SelfieVerification" component={SelfieVerificationScreen} />
    <Stack.Screen name="BankDetails" component={BankDetailsScreen} />
    <Stack.Screen name="IncomeVerification" component={IncomeVerificationScreen} />
    <Stack.Screen name="VkycScreen" component={VkycScreen} />
    <Stack.Screen name="EnachEsign" component={EnachEsignScreen} />
    <Stack.Screen name="LoanSuccess" component={LoanSuccessScreen} />

    {/* Employee Loan */}
    <Stack.Screen name="EmployeeLoan" component={EmployeeLoanScreen} />

    {/* Dashboard */}
    <Stack.Screen name="MyLoans" component={MyLoansScreen} />
    <Stack.Screen name="LoanDetail" component={LoanDetailScreen} />
    <Stack.Screen name="Profile" component={ProfileScreen} />

    {/* Servicing */}
    <Stack.Screen name="Prepayment" component={PrepaymentScreen} />
    <Stack.Screen name="NocRequest" component={NocRequestScreen} />

    {/* Engagement */}
    <Stack.Screen name="CreditScore" component={CreditScoreScreen} />
    <Stack.Screen name="Referral" component={ReferralScreen} />
    <Stack.Screen name="Offers" component={OffersScreen} />
    <Stack.Screen name="DailyCheckIn" component={DailyCheckInScreen} />

    {/* Admin */}
    <Stack.Screen name="LoanQueue" component={LoanQueueScreen} />
  </Stack.Navigator>
);

export default AppNavigator;
