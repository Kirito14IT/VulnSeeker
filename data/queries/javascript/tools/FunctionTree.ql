import javascript 
 
from Function f 
select f.getName() as function_name, f.getFile().getAbsolutePath() as file, f.getLocation().getStartLine() as start_line, f.getFile().getAbsolutePath() + ":" + f.getLocation().getStartLine().toString() as function_id, f.getLocation().getEndLine() as end_line, "" as caller_id
