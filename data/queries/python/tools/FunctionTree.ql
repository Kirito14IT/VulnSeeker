import python 
 
from Function f 
select f.getName() as function_name, f.getLocation().getFile().getAbsolutePath() as file, f.getLocation().getStartLine() as start_line, f.getLocation().getFile().getAbsolutePath() + ":" + f.getLocation().getStartLine().toString() as function_id, f.getLocation().getEndLine() as end_line, "" as caller_id
