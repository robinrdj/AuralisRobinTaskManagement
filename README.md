**Deployment link**  
Deployed in both vercel and netlify  
[**https://auralis-robin-task-management.vercel.app/**](https://auralis-robin-task-management.vercel.app/)  
https://auralis-robin-task-mangament.netlify.app/

**Github link**  
[https://github.com/robinrdj/AuralisRobinTaskManagement](https://github.com/robinrdj/AuralisRobinTaskManagement)

---

**Project setup and installation instructions**  
Enter the following things in your terminal

\-Git clone the repository  
git clone [https://github.com/robinrdj/AuralisRobinTaskManagement](https://github.com/robinrdj/AuralisRobinTaskManagement)

\-Don’t forget to change repository after cloning  
cd AuralisRobinTaskManagement

\-npm install it to install all the packages inside package.json  
npm install

\-npm start to run the application  
npm start

---

**Available scripts and how to run them**  
Scripts are available for running, building, linting and formatting the application

npm start   
\- to run the application  
npm build  
 \- creates an optimized, production-ready version of your app in /build folder.  
npm lint  
\- to look for unused variable and styling inconsistencies  
npm format  
\- to format the code with consistent indentation, spacing  
npm check  
\- to run both lint and format together

---

**Architecture overview and key design decisions**  
First of all, created a store with two reducers,   
\-taskSlice.tsx   
\-themeSlice.tsx  
And the store has been wrapped around the entire application.

| Paths | Functionality | Main Page Component | Involved Components |
| :---- | :---- | :---- | :---- |
| /  | for adding tasks  | \<AddTask /\> | \- |
| /taskboard | for viewing, searching,sorting and filtering tasks | \<TaskBoard /\> | \<TaskCard /\> \<TaskColumn /\> \<MultiUpdateModal /\> \<EmptyStateMessage /\> \<FilterBar /\> \<SearchSortBar /\> \<SelectionControls /\> |
| /uploadTasks | for bulk uploading tasks through json file  | \<UploadJson /\> | \- |
|  /analytics  | Contains four chart components and one overdue tasks  | \<Analytics /\> | \<PriorityDistribution /\> \<ProductivityMetrics /\> \<StatusOverview /\> \<OverdueTasks /\> \<StaticTaskCard /\> \<TaskCompletionRate /\> |

**Input Design**  
**Title**: string (required, won’t let you to create task without specifying it)  
**description**:string(if not specified, would be empty string)  
**due\_date**:string(if not specified, would be empty string and would become null on task creation)  
**status**: could be one of the following \-  “todo”, “inprogress”, “review” , “completed”   
            (by default, set to “todo”)  
**priority**: could be one of the following \- “low”, “medium” , “high”   
            (by default, set to “low”)

While storing the data in redux and localstorage, it will create additional props such as  
**created\_on**: string and  
**completed\_on**:  string 

**Styling Choice**  
\-Notistack is used for messages and alert  
\-Combination of inline and external css is used for styling and that is by choice. Inline style usually contains parameters that need adjusting and to be easily visible for developers when they want to adjust the style.

**Functional Choice**  
\-@hello-pangea/dnd  
For dragging and dropping of task cards

**Design Choices**  
**Chart design**  
Removed the  legends to maintain clean look and thus used dataset label feature for mentioning additional details reg the nature of the chart.  
Download icon without text is intentional and to give a clean look.

---

**Custom hooks**  
\-useBoardDataHook \- takes care of the sorting, filtering and searching functions  
\-useFiltersHook- for setting the value for sort and search and filters  
\-useTaskSelectionHook- operations related to selected task cards.  
\-useDownloadTasksHook \- to handle the download operations  
\-useExportToExcelHook \- to download the data present in analytics page

useCallback and useMemo are used across various custom hooks.

---

**Trade-offs made and reasoning behind choices**  
**Virtualization**: Considered for large lists (100+ items) but omitted due to integration issues with drag-and-drop.   
**Date Input**: Accepts any format but displays NaN-NaN-NaN for invalid dates; this is intentional to avoid excessive warnings for bulk imports.  
---

**Known limitations or areas for improvement**  
**Known limitations**  
**Filter Reset:** Clearing date ranges requires disabling all filters, which also hides the filter bar. **Date Format:** Invalid date formats are accepted but result in placeholder values; could be improved with more granular warnings. 

**Areas of Improvement**  
**Assignee Management:** Currently string-based; could be enhanced with a dedicated assignee management page and dropdown selection.

Could be really useful while adding tasks, instead of string assignee, we could give them a dropdown to choose from.  
---

**Time breakdown of how you spent the 6 days**  
**Day-1**  
spent more time on understanding the reqs and searching for correct packages to use for drag and drop of task cards  and charts and initialized the application.

**Day-2**  
Created a store with Task and theme reducers to be accessible across the entire application.

**Day-3**  
Worked on the Add task page and task board page and completed them with basic styling.

**Day-4**  
Worked on the Analytics page and completed it with improved styles for overall application.  
Identified date formatting inconsistencies and solved it throughout the entire application.

**Day-5**  
Implemented memoization, and made the analytics chart components responsive with the introduction of Wrapperclass.

**Day-6**  
Worked on documentation. Added framer motion to the application. Added clip loader for loading and styling issues fixed.  
---

**1.Task Management System**  
**Task Operations**  
All the task operations mentioned in the requirement document such as create task,edit tasks, delete tasks, bulk operations and drag and drop are completed.  
Task Organization  
All the organization requirements mentioned in the document such as status columns, filtering, searching and sorting are completed.

**2.Data Management and state**  
\-Data is stored and retrieved from local storage with proper serialization and deserialization.  
\-Redux Toolkit is used for state management.  
\-Ui is optimised for better user experience by custom styling, and using framer motion and the successful interactions are provided with success messages using notistack.  
\-Error handling is done with appropriate messages with the use of notistack.

**3.Analytics Dashboard**  
Separate Chart  Components such as   
\-PriorityDistribution  
\-ProductivityMetrics  
\-TaskCompletionRate  
\-OverdueTask  
\-StatusOveriw  
are created.

**Advanced features and bonus points are discussed below**

**Any additional features or optimizations implemented**  
**Dark/Light Theme: Toggle with system preference detection**  
Theme is set up with the help of redux js toolkit and is used throughout the entire application

**Responsive Design: Mobile-first approach, works well on all screen sizes**  
Entire application is completely responsive thanks to custom media query stylings, react grids system and custom styling.

**Code Splitting: Lazy load the analytics dashboard**  
Lazy loaded the analytics dashboard  
Used the following in the app.tsx  
const Analytics \= lazy(() \=\> import("./components/Analytics"));  
\<Route   
path="/analytics"   
element=  
{   
\<Suspense fallback={\<div\>Loading Analytics...\</div\>}\>  
 \<Analytics /\>  
 \</Suspense\>  
 }   
/\>

**Empty States: Meaningful empty states with call-to-action**  
Created a responsive EmptyStateMessage component with a smiley face and a direction message and used it inside the task board when there are no tasks in the task board.

**Custom Hooks: Advanced custom hooks for complex logic**  
Custom hooks are created for complex logics and used.  
Such as  
\-useBoardData  
\-useDownloadTasks  
\-useFilters  
\-useTaskSelection

**Advanced Animations: Smooth transitions and micro-interactions using Framer Motion**  
Used on the Analytics page, charts now animate into view sequentially thanks to framer motion and also.applied a scroll-triggered slide-and-fade animation to the "Overdue Tasks" section using Framer Motion. Also used in AddTasks and uploadJson pages.

**Export: Export tasks to JSON or CSV format**  
Downloadable buttons for downloading json and csv files  are presented in /taskboard page

**Import: Import tasks from JSON with validation and conflict resolution**  
Upload buttons for uploading json file of  tasks are presented in /uploadJson page

**Loading States: Skeleton screens and loading indicators**  
Loading indicators are used but the skeleton screens are not used considering the use of framer motion.

**Debounced Search: Implement debounced search functionality**  
Searching functionality uses debouncing with a current delay of 300 milliseconds and the function it uses is shown below.  
useEffect(() \=\> { const timer \= setTimeout(() \=\> { setDebouncedSearch(searchText.toLowerCase()); }, 300); return () \=\> clearTimeout(timer); }, \[searchText\]);

**Memoization: Proper use of React.memo, useMemo, and useCallback**  
Memoization is strategically used to optimize performance and reduce unnecessary re-renders. `React.memo` wraps components like `TaskCard` to re-render only on prop changes. `useMemo` caches expensive computations in hooks like `useBoardDataHook`, and `useCallback` ensures stable function references for event handlers. This keeps the app responsive as task volume and interactions scale.

**Accessibility: ARIA labels, screen reader support, high contrast mode**  
Accessibility is ensured through ARIA labels and roles on all key interactive elements, enhancing screen reader navigation. Descriptive labels and region roles improve usability for assistive technologies. High contrast and dark mode themes support users with visual impairments.

**Export Analytics data**  
You  can download all the chart data into separate worksheets into excel by pressing the button present on the analytics page.  
---

**Note**  
Commented the code extensively, to give more clarity and as it is an assignment. In a real working environment, I could reduce it, if needed.

**Future Improvements**   
Customizable Status & Priority Colors: Allow users to set their own color schemes.   
Task History: Track changes, status durations, comments, and knowledge tags. Assignee Management: Dedicated page and dropdown selection for assignees.  
