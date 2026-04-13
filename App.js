import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import SearchScreen from './screens/SearchScreen';
import ResultsScreen from './screens/ResultsScreen';
import DetailScreen from './screens/DetailScreen';
import BookmarksScreen from './screens/BookmarksScreen';
import SettingsScreen from './screens/SettingsScreen';
import ImpactFactorsScreen from './screens/ImpactFactorsScreen';
import AddScreen from './screens/AddScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function AddStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="AddHome" component={AddScreen} options={{ headerShown: false }} />
      <Stack.Screen name="AddDetail" component={DetailScreen} options={{ title: 'Paper Details' }} />
    </Stack.Navigator>
  );
}

function SearchStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="SearchHome" component={SearchScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Results" component={ResultsScreen} options={{ title: 'Results' }} />
      <Stack.Screen name="Detail" component={DetailScreen} options={{ title: 'Trial Detail' }} />
    </Stack.Navigator>
  );
}

function BookmarksStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="BookmarksHome" component={BookmarksScreen} options={{ title: 'Saved Trials' }} />
      <Stack.Screen name="BookmarkDetail" component={DetailScreen} options={{ title: 'Trial Detail' }} />
    </Stack.Navigator>
  );
}

function SettingsStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="SettingsHome" component={SettingsScreen} options={{ title: 'Settings' }} />
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
            const icons = { Search: 'search', Add: 'add-circle', Saved: 'bookmark', Settings: 'settings-outline' };
            return <Ionicons name={icons[route.name]} size={size} color={color} />;
          },
          tabBarActiveTintColor: '#0066CC',
          tabBarInactiveTintColor: 'gray',
          headerShown: false,
        })}
      >
        <Tab.Screen name="Search" component={SearchStack} />
        <Tab.Screen name="Add" component={AddStack} />
        <Tab.Screen name="Saved" component={BookmarksStack} />
        <Tab.Screen name="Settings" component={SettingsStack} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}