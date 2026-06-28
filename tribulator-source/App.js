import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';

import SearchScreen from './screens/SearchScreen';
import ResultsScreen from './screens/ResultsScreen';
import DetailScreen from './screens/DetailScreen';
import SavedScreen from './screens/SavedScreen';
import SettingsScreen from './screens/SettingsScreen';
import ImpactFactorsScreen from './screens/ImpactFactorsScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function SearchStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="Search" component={SearchScreen} options={{ title: 'Tribulator' }} />
      <Stack.Screen name="Results" component={ResultsScreen} options={{ title: 'Results' }} />
      <Stack.Screen name="Detail" component={DetailScreen} options={{ title: 'Trial Detail' }} />
    </Stack.Navigator>
  );
}

function SavedStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="Saved" component={SavedScreen} options={{ title: 'Saved Trials' }} />
      <Stack.Screen name="SavedDetail" component={DetailScreen} options={{ title: 'Trial Detail' }} />
    </Stack.Navigator>
  );
}

function SettingsStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
      <Stack.Screen name="ImpactFactors" component={ImpactFactorsScreen} options={{ title: 'Journal Impact Factors' }} />
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <NavigationContainer>
      <StatusBar style="auto" />
      <Tab.Navigator
        screenOptions={({ route }) => ({
          tabBarIcon: ({ color, size }) => {
            const icons = {
              Search: 'search',
              Saved: 'bookmark',
              Settings: 'settings-outline',
            };
            return <Ionicons name={icons[route.name]} size={size} color={color} />;
          },
          tabBarActiveTintColor: '#0066CC',
          tabBarInactiveTintColor: 'gray',
          headerShown: false,
        })}
      >
        <Tab.Screen name="Search" component={SearchStack} />
        <Tab.Screen name="Saved" component={SavedStack} />
        <Tab.Screen name="Settings" component={SettingsStack} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
